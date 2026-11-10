import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PHYSICIANS } from '../domain/seed';
import type { AuthorizationRequest } from '../domain/types';
import * as wf from '../domain/workflow';

const KEY = 'niagara-autoriza:v2';
const H = 3600_000;

function seedCases(): AuthorizationRequest[] {
  const at = (hoursAgo: number) => {
    let t = Date.now() - hoursAgo * H;
    return () => (t += 4 * 60_000 + Math.random() * 20 * 60_000);
  };
  const run = (hoursAgo: number, fn: () => AuthorizationRequest) => wf.withClock(at(hoursAgo), fn);
  const order = (patientId: string, cups: string, ph: number, urgency: AuthorizationRequest['urgency'] = 'rutina') =>
    wf.createRequest({ patientId, cups, physician: PHYSICIANS[ph], urgency });

  const later = (hoursAgo: number, r: AuthorizationRequest, f: (r: AuthorizationRequest) => AuthorizationRequest) =>
    wf.withClock(at(hoursAgo), () => f(r));

  const c: AuthorizationRequest[] = [];
  // aprobada y agendada
  let r = run(120, () => order('p2', '883522', 0));
  c.push(later(104, r, (x) => wf.payerDecision(x, true)));
  // faltan documentos
  c.push(run(3, () => order('p1', '883522', 0)));
  c.push(run(26, () => order('p3', '891901', 5)));
  c.push(run(6, () => order('p5', '452301', 1, 'prioritaria')));
  // revisión clínica (alto costo)
  c.push(run(5, () => order('p4', '806101', 0)));
  // negada → borrador de apelación
  r = run(96, () => order('p6', '133100', 3));
  r = later(94, r, (x) => wf.provideEvidence(x, 'historia_previa', 'Agudeza visual 20/200 OD, progresión en 6 meses'));
  r = later(92, r, (x) => wf.approveClinicalReview(x));
  c.push(later(76, r, (x) => wf.payerDecision(x, false, 'no_pertinencia')));
  // radicada por WhatsApp, esperando
  c.push(run(20, () => order('p7', '881201', 2)));
  // circuito abierto → diferida
  c.push(run(2, () => order('p8', '879301', 4)));
  // negada por falta de evidencia → borrador
  r = run(70, () => order('p9', '452301', 1));
  c.push(later(54, r, (x) => wf.payerDecision(x, false, 'falta_evidencia')));
  // aprobada por fax
  r = run(60, () => order('p10', '879301', 4, 'prioritaria'));
  c.push(later(50, r, (x) => wf.payerDecision(x, true)));
  // en apelación
  r = run(140, () => order('p11', '891901', 5));
  r = later(126, r, (x) => wf.payerDecision(x, false, 'codigo_errado'));
  c.push(later(120, r, (x) => wf.signAppeal(x, x.appeal!.draft)));
  // sin PA
  c.push(run(10, () => order('p12', '883522', 0)));
  c.push(run(8, () => order('p7', '890263', 2)));
  // prepagada consulta → aprobada
  r = run(50, () => order('p4', '890263', 2));
  c.push(later(44, r, (x) => wf.payerDecision(x, true)));
  // negada no cubierta → no se recomienda apelar
  r = run(75, () => order('p11', '883522', 0));
  c.push(later(62, r, (x) => wf.payerDecision(x, false, 'no_cubierto')));
  // apelación ganada
  r = run(200, () => order('p9', '881201', 2));
  r = later(186, r, (x) => wf.payerDecision(x, false, 'falta_evidencia'));
  r = later(182, r, (x) => wf.signAppeal(x, x.appeal!.draft));
  c.push(later(160, r, (x) => wf.appealOutcome(x, true)));
  // otra aprobada API
  r = run(30, () => order('p2', '881201', 2));
  c.push(later(24, r, (x) => wf.payerDecision(x, true)));
  return c.sort((a, b) => b.orderedAt - a.orderedAt);
}

interface Store {
  cases: AuthorizationRequest[];
  get: (id: string) => AuthorizationRequest | undefined;
  upsert: (r: AuthorizationRequest) => void;
  update: (id: string, f: (r: AuthorizationRequest) => AuthorizationRequest) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<AuthorizationRequest[]>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved: AuthorizationRequest[] = JSON.parse(raw);
        wf.ensureSeqAbove(saved.map((c) => c.id));
        return saved;
      }
    } catch {
      /* datos corruptos: se regeneran */
    }
    return seedCases();
  });

  useEffect(() => localStorage.setItem(KEY, JSON.stringify(cases)), [cases]);

  const store = useMemo<Store>(
    () => ({
      cases,
      get: (id) => cases.find((c) => c.id === id),
      upsert: (r) => setCases((cs) => [r, ...cs.filter((c) => c.id !== r.id)]),
      update: (id, f) => setCases((cs) => cs.map((c) => (c.id === id ? f(c) : c))),
      reset: () => setCases(seedCases()),
    }),
    [cases],
  );
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider ausente');
  return s;
};
