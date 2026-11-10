import { expectedValue } from '../domain/appeals';
import { breakerState } from '../domain/payerAdapters';
import { CHANNEL_LABEL, PAYERS, payerById, procedureByCups } from '../domain/payers';
import { patientById } from '../domain/seed';
import { completeness } from '../domain/scoring';
import { STATUS_LABEL } from '../domain/stateMachine';
import type { AuthorizationRequest, RequestStatus } from '../domain/types';
import { ago, Bar, Card, Icon, navigate, StatusPill } from '../components/ui';
import { useStore } from '../state/store';

const ACTIVE: RequestStatus[] = ['DOCS_PENDING', 'READY', 'CLINICAL_REVIEW', 'SUBMITTED', 'DENIED', 'APPEALED'];

function exceptionsOf(cases: AuthorizationRequest[]) {
  const out: { c: AuthorizationRequest; kind: string; text: string; tone: string; icon: string }[] = [];
  for (const c of cases) {
    if (c.status === 'CLINICAL_REVIEW') out.push({ c, kind: 'Revisión clínica', text: procedureByCups(c.cups).name, tone: 't-violet', icon: 'scale' });
    if (c.status === 'DENIED' && c.appeal?.status === 'draft') out.push({ c, kind: 'Firmar apelación', text: `VE $${expectedValue(c).toFixed(0)} · ${payerById(c.payerId).name}`, tone: 't-red', icon: 'doc' });
    if (c.status === 'READY' && c.events.at(-1)?.type === 'submit.deferred') out.push({ c, kind: 'Radicación diferida', text: `Circuito abierto · ${payerById(c.payerId).name}`, tone: 't-amber', icon: 'alert' });
    if (c.status === 'SUBMITTED' && c.slaDueAt && c.slaDueAt < Date.now()) out.push({ c, kind: 'SLA vencido', text: `Escalar con ${payerById(c.payerId).name}`, tone: 't-amber', icon: 'clock' });
  }
  return out;
}

export default function Dashboard() {
  const { cases } = useStore();
  const active = cases.filter((c) => ACTIVE.includes(c.status));
  const decided = cases.filter((c) => c.decidedAt && c.submittedAt);
  const avgDecisionH = decided.length ? decided.reduce((s, c) => s + (c.decidedAt! - c.orderedAt), 0) / decided.length / 3600_000 : 0;
  const paCases = cases.filter((c) => c.dossier.length > 0);
  const stp = paCases.length ? paCases.filter((c) => c.humanTouches === 0 && !c.events.some((e) => e.actor === 'Médico' && e.type === 'evidence.provided')).length / paCases.length : 0;
  const denials = cases.filter((c) => c.denial);
  const appealable = denials.filter((c) => c.appeal);
  const atStake = cases.filter((c) => c.status === 'DENIED' && c.appeal).reduce((s, c) => s + expectedValue(c), 0);
  const exceptions = exceptionsOf(cases);
  const counts = ACTIVE.map((s) => ({ s, n: cases.filter((c) => c.status === s).length }));
  const maxCount = Math.max(1, ...counts.map((c) => c.n));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Tablero de autorizaciones</h1>
          <p>Toda la operación en tiempo real. Las personas solo ven las excepciones.</p>
        </div>
        <div className="top-actions">
          <a className="btn btn-blue" href="#/app/nueva">
            <Icon name="plus" size={16} /> Nueva solicitud
          </a>
        </div>
      </div>

      <div className="grid g4">
        <div className="card kpi hero-kpi">
          <div className="label">Horas promedio orden → decisión</div>
          <div className="value">{avgDecisionH.toFixed(1)} h</div>
          <div className="delta">
            Antes: <b>4,2 días hábiles</b> (≈ 34 h)
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Procesamiento sin intervención (STP)</div>
          <div className="value">{Math.round(stp * 100)} %</div>
          <div className="delta">
            Meta <b>≥ 60 %</b> · antes ~0 %
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Casos activos</div>
          <div className="value">{active.length}</div>
          <div className="delta">{exceptions.length} requieren a una persona</div>
        </div>
        <div className="card kpi">
          <div className="label">Valor esperado en apelaciones</div>
          <div className="value">${Math.round(atStake).toLocaleString('es-CO')}</div>
          <div className="delta">
            {appealable.length}/{denials.length} negaciones con apelación · antes <b>41 %</b>
          </div>
        </div>
      </div>

      <div className="grid g-main" style={{ marginTop: 18 }}>
        <Card title="Solicitudes" extra={<small>{cases.length} en total</small>}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Paciente / servicio</th>
                  <th>Pagador</th>
                  <th>Expediente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const p = patientById(c.patientId);
                  const payer = payerById(c.payerId);
                  return (
                    <tr key={c.id} className="click" onClick={() => navigate(`/app/casos/${c.id}`)}>
                      <td>
                        <b>{c.id}</b>
                        <div className="sub">{ago(c.orderedAt)}</div>
                      </td>
                      <td>
                        {p.name}
                        <div className="sub">{procedureByCups(c.cups).name}</div>
                      </td>
                      <td>
                        {payer.name}
                        <div className="sub">{CHANNEL_LABEL[payer.channel]}</div>
                      </td>
                      <td style={{ width: 110 }}>
                        {c.dossier.length ? (
                          <>
                            <Bar value={completeness(c.dossier)} good={completeness(c.dossier) === 1} />
                            <div className="sub">{Math.round(completeness(c.dossier) * 100)} %</div>
                          </>
                        ) : (
                          <span className="sub">No requiere PA</span>
                        )}
                      </td>
                      <td>
                        <StatusPill s={c.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Bandeja de excepciones" extra={<span className="pill t-amber">{exceptions.length}</span>}>
            <div className="list">
              {exceptions.length === 0 && <div className="empty">Sin excepciones. Todo fluye solo.</div>}
              {exceptions.map((e) => (
                <a className="task" key={e.c.id + e.kind} href={`#/app/casos/${e.c.id}`}>
                  <span className={`dot ${e.tone}`}>
                    <Icon name={e.icon} size={16} />
                  </span>
                  <span className="txt">
                    <b>
                      {e.kind} · {e.c.id}
                    </b>
                    <span>{e.text}</span>
                  </span>
                  <Icon name="arrow" size={16} />
                </a>
              ))}
            </div>
          </Card>

          <Card title="Pipeline por estado">
            <div className="bars">
              {counts.map(({ s, n }) => (
                <div className="hbar" key={s}>
                  <div className="lbl">
                    <span>{STATUS_LABEL[s]}</span>
                    <b>{n}</b>
                  </div>
                  <div className="track">
                    <i style={{ width: `${(n / maxCount) * 100}%`, background: 'linear-gradient(90deg,#2f7bff,#45cdff)' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Salud de integraciones" extra={<small>circuit breaker por pagador</small>}>
            <div className="list">
              {PAYERS.filter((p) => p.type !== 'Particular')
                .slice(0, 8)
                .map((p) => {
                  const st = breakerState(p.id);
                  const tone = st === 'cerrado' ? 't-green' : st === 'abierto' ? 't-red' : 't-amber';
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>
                        {p.name} <span className="tag">{CHANNEL_LABEL[p.channel]}</span>
                      </span>
                      <span className={`pill ${tone}`}>{st}</span>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
