// Capa de aplicación: casos de uso que mueven el caso por los pipelines P1–P7.
// Funciones puras: reciben un caso y devuelven uno nuevo (+ eventos en la bitácora).
import { makeDenial, shouldAppeal, draftAppeal, expectedValue, CATEGORY_LABEL } from './appeals';
import { submitIdempotent } from './payerAdapters';
import { CHANNEL_LABEL, payerById, policyFor, procedureByCups } from './payers';
import { completeness, extractEvidence, missingItems, needsClinicalReview, RuleBasedScorer } from './scoring';
import { patientById } from './seed';
import { assertTransition } from './stateMachine';
import type { AuthorizationRequest, CaseEvent, DenialCategory, RequestStatus } from './types';

let clock = () => Date.now();
export function withClock<T>(fn: () => number, run: () => T): T {
  const prev = clock;
  clock = fn;
  try {
    return run();
  } finally {
    clock = prev;
  }
}

const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

function log(req: AuthorizationRequest, actor: CaseEvent['actor'], type: string, detail: string): AuthorizationRequest {
  return { ...req, events: [...req.events, { id: uid(), at: clock(), actor, type, detail }] };
}

function go(req: AuthorizationRequest, to: RequestStatus): AuthorizationRequest {
  assertTransition(req.status, to);
  return { ...req, status: to };
}

let seq = 1040;
export const nextId = () => `PA-${++seq}`;
/** Evita ids repetidos al recargar casos guardados. */
export function ensureSeqAbove(ids: string[]) {
  for (const id of ids) seq = Math.max(seq, Number(id.replace('PA-', '')) || 0);
}

export interface NewOrder {
  patientId: string;
  cups: string;
  physician: string;
  urgency: AuthorizationRequest['urgency'];
}

/** P1 + P2 + P3: captura, elegibilidad, reglas y expediente con IA. */
export function createRequest(o: NewOrder, channelIn: 'HCE' | 'Fax (OCR)' = 'HCE'): AuthorizationRequest {
  const patient = patientById(o.patientId);
  const proc = procedureByCups(o.cups);
  const payer = payerById(patient.payerId);
  let r: AuthorizationRequest = {
    id: nextId(),
    patientId: patient.id,
    payerId: patient.payerId,
    cups: o.cups,
    physician: o.physician,
    urgency: o.urgency,
    status: 'RECEIVED',
    orderedAt: clock(),
    dossier: [],
    humanTouches: 0,
    events: [],
  };
  r = log(r, 'Médico', 'order.created', `Orden ${proc.name} (CUPS ${proc.cups}) desde ${channelIn}`);
  if (channelIn !== 'HCE') r = log(r, 'IA', 'order.ocr', 'OCR + extracción: 7 campos con confianza 0,96');
  r = log(r, 'Plataforma', 'order.normalized', 'Orden normalizada (CUPS / CIE-10 validados)');
  r = go(r, 'ELIGIBILITY_CHECK');
  r = log(r, 'Plataforma', 'eligibility.ok', `Afiliación activa en ${payer.name} · plan ${patient.plan}`);

  const policy = policyFor(patient.payerId, o.cups);
  if (!policy.requiresPA) {
    r = log(r, 'Plataforma', 'pa.not_required', `Regla ${policy.policyVersion}: no requiere autorización previa`);
    r = go(r, 'SCHEDULED');
    return log({ ...r, appointment: nextSlot(3) }, 'Plataforma', 'appointment.booked', `Autoagendado: ${nextSlot(3)}`);
  }
  r = log(r, 'Plataforma', 'pa.required', `Regla ${policy.policyVersion}: requiere PA · ${policy.evidence.length} evidencias · SLA ${policy.slaHours} h`);
  r = { ...r, slaDueAt: clock() + policy.slaHours * 3600_000 };
  r = go(r, 'DOCS_PENDING');
  const dossier = extractEvidence(patient, policy.evidence);
  r = { ...r, dossier };
  const found = dossier.filter((d) => d.status === 'found').length;
  r = log(r, 'IA', 'dossier.extracted', `Evidencia extraída de la HCE: ${found}/${dossier.length} ítems con cita a la fuente`);
  const missing = missingItems(dossier);
  if (missing.length) {
    return log(r, 'Plataforma', 'physician.task', `Tarea al médico en la HCE: completar ${missing.map((m) => m.label.toLowerCase()).join('; ')}`);
  }
  return markReady(r);
}

function markReady(r: AuthorizationRequest): AuthorizationRequest {
  r = go(r, 'READY');
  const risk = RuleBasedScorer.score(r);
  r = log({ ...r, riskScore: risk }, 'Plataforma', 'dossier.complete', `Expediente 100 % · riesgo de negación ${(risk * 100).toFixed(0)} % (${RuleBasedScorer.name})`);
  if (needsClinicalReview(risk, r.cups)) {
    r = go(r, 'CLINICAL_REVIEW');
    return log(r, 'Plataforma', 'review.required', procedureByCups(r.cups).highCost ? 'Alto costo → revisión clínica' : 'Riesgo alto → revisión clínica');
  }
  return submit(r);
}

/** El médico completa un faltante (1 clic dentro de la HCE). */
export function provideEvidence(r: AuthorizationRequest, code: string, note: string): AuthorizationRequest {
  if (r.status !== 'DOCS_PENDING') return r;
  const dossier = r.dossier.map((d) =>
    d.code === code ? { ...d, status: 'provided' as const, source: 'Aportado por el médico', excerpt: note ? `"${note}"` : undefined, confidence: 1 } : d,
  );
  r = log({ ...r, dossier }, 'Médico', 'evidence.provided', `Completó: ${dossier.find((d) => d.code === code)?.label}`);
  return completeness(dossier) === 1 ? markReady(r) : r;
}

export function approveClinicalReview(r: AuthorizationRequest, reviewer = 'Gestor PA'): AuthorizationRequest {
  r = log({ ...r, humanTouches: r.humanTouches + 1 }, 'Gestor PA', 'review.approved', `${reviewer} validó la pertinencia clínica`);
  return submit(r);
}

/** P4: radicación idempotente vía el adaptador del pagador. */
export function submit(r: AuthorizationRequest): AuthorizationRequest {
  const res = submitIdempotent(r);
  if ('deferred' in res) return log(r, 'Plataforma', 'submit.deferred', res.reason);
  r = go(r, 'SUBMITTED');
  r = { ...r, payerReference: res.reference, channel: res.channel, submittedAt: clock() };
  r = log(r, 'Plataforma', 'request.submitted', `Radicado ${res.reference} vía ${CHANNEL_LABEL[res.channel]} · ${res.detail}`);
  return log(r, 'Plataforma', 'tracking.started', res.channel === 'api' ? 'Escuchando webhook del pagador' : 'Bot de consulta programado cada 3 h');
}

/** P5 → P6 / P7: decisión del pagador. */
export function payerDecision(r: AuthorizationRequest, approve: boolean, category: DenialCategory = 'falta_evidencia'): AuthorizationRequest {
  if (r.status !== 'SUBMITTED' && r.status !== 'APPEALED') return r;
  const payer = payerById(r.payerId);
  r = { ...r, decidedAt: clock() };
  if (approve) {
    r = go(r, 'APPROVED');
    r = log(r, 'Pagador', 'decision.approved', `${payer.name} aprobó · autorización ${r.payerReference}`);
    return schedule(r);
  }
  const denial = makeDenial(category);
  r = go({ ...r, denial }, 'DENIED');
  r = log(r, 'Pagador', 'decision.denied', `${payer.name} negó: "${denial.reason}"`);
  const ev = expectedValue(r);
  r = log(r, 'IA', 'denial.classified', `Motivo: ${CATEGORY_LABEL[category]} · P(revocar) ${(denial.reversalProbability * 100).toFixed(0)} % · valor esperado $${ev.toFixed(0)}`);
  if (shouldAppeal(r)) {
    r = { ...r, appeal: { draft: draftAppeal(r), status: 'draft' } };
    return log(r, 'IA', 'appeal.drafted', 'Borrador de apelación generado con evidencia citada → bandeja de apelaciones');
  }
  return log(r, 'Plataforma', 'appeal.not_recommended', 'Valor esperado bajo el umbral: se recomienda cerrar con aprendizaje');
}

export function signAppeal(r: AuthorizationRequest, draft: string, by = 'Gestor clínico PA'): AuthorizationRequest {
  if (r.status !== 'DENIED') return r;
  r = go({ ...r, appeal: { draft, status: 'signed', signedBy: by }, humanTouches: r.humanTouches + 1 }, 'APPEALED');
  r = log(r, 'Gestor PA', 'appeal.signed', `${by} validó y firmó la apelación`);
  return log(r, 'Plataforma', 'appeal.submitted', 'Apelación radicada · llamada de revisión agendada en < 48 h');
}

export function appealOutcome(r: AuthorizationRequest, won: boolean): AuthorizationRequest {
  if (r.status !== 'APPEALED') return r;
  if (won) {
    r = { ...r, appeal: { ...r.appeal!, status: 'won' } };
    return payerDecision(log(r, 'Pagador', 'appeal.won', 'Negación revocada en revisión'), true);
  }
  r = go({ ...r, appeal: { ...r.appeal!, status: 'lost' } }, 'CLOSED');
  return log(r, 'Gestor PA', 'tutela.prepared', 'Apelación no prospera: expediente de tutela preparado con el paciente');
}

export function closeDenial(r: AuthorizationRequest): AuthorizationRequest {
  if (r.status !== 'DENIED') return r;
  return log(go(r, 'CLOSED'), 'Gestor PA', 'denial.closed', 'Cerrada sin apelación · motivo enviado al motor de reglas');
}

function schedule(r: AuthorizationRequest): AuthorizationRequest {
  const slot = nextSlot(r.urgency === 'urgente' ? 1 : 4);
  r = go({ ...r, appointment: slot }, 'SCHEDULED');
  r = log(r, 'Plataforma', 'appointment.booked', `Autoagendado: ${slot}`);
  return log(r, 'Paciente', 'patient.notified', 'Cita confirmada por WhatsApp · recordatorios −72 h / −24 h');
}

function nextSlot(days: number) {
  const d = new Date(clock() + days * 86400000);
  d.setHours(7 + (d.getDate() % 9), d.getDate() % 2 ? 30 : 0);
  return d.toLocaleString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
