import { useState } from 'react';
import { CATEGORY_LABEL, expectedValue } from '../domain/appeals';
import { breakerState, setBreaker } from '../domain/payerAdapters';
import { CHANNEL_LABEL, payerById, procedureByCups } from '../domain/payers';
import { patientById } from '../domain/seed';
import { completeness } from '../domain/scoring';
import { HAPPY_PATH, STATUS_LABEL } from '../domain/stateMachine';
import type { AuthorizationRequest, DenialCategory } from '../domain/types';
import * as wf from '../domain/workflow';
import { Bar, Card, fmtDate, Icon, StatusPill } from '../components/ui';
import { useStore } from '../state/store';

export default function CaseDetail({ id }: { id: string }) {
  const { get, update } = useStore();
  const c = get(id);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<string | null>(null);
  const [category, setCategory] = useState<DenialCategory>('falta_evidencia');

  if (!c) return <div className="empty">Caso no encontrado.</div>;
  const p = patientById(c.patientId);
  const payer = payerById(c.payerId);
  const proc = procedureByCups(c.cups);
  const act = (f: (r: AuthorizationRequest) => AuthorizationRequest) => update(c.id, f);
  const pathIndex = HAPPY_PATH.indexOf(
    c.status === 'CLINICAL_REVIEW' ? 'READY' : c.status === 'DENIED' || c.status === 'APPEALED' ? 'SUBMITTED' : c.status === 'CLOSED' ? 'SCHEDULED' : c.status === 'ELIGIBILITY_CHECK' ? 'RECEIVED' : c.status,
  );
  const deferred = c.status === 'READY' && c.events.at(-1)?.type === 'submit.deferred';
  const slaLeft = c.slaDueAt ? (c.slaDueAt - Date.now()) / 3600_000 : null;

  return (
    <>
      <div className="topbar">
        <a className="btn btn-ghost btn-sm" href="#/app">
          <Icon name="back" size={14} /> Tablero
        </a>
      </div>

      <div className="card">
        <div className="case-head">
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <h1 style={{ fontSize: 26 }}>{c.id}</h1>
              <StatusPill s={c.status} />
              {c.urgency !== 'rutina' && <span className="pill t-red">{c.urgency}</span>}
            </div>
            <p style={{ color: 'var(--muted)', marginTop: 4 }}>
              {proc.name} · CUPS {proc.cups} · ${proc.amount.toLocaleString('es-CO')}
            </p>
          </div>
          {slaLeft !== null && !['APPROVED', 'SCHEDULED', 'CLOSED'].includes(c.status) && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>SLA del pagador</div>
              <b style={{ color: slaLeft < 0 ? 'var(--red)' : 'var(--ink)' }}>{slaLeft < 0 ? `Vencido hace ${Math.abs(slaLeft).toFixed(0)} h` : `${slaLeft.toFixed(0)} h restantes`}</b>
            </div>
          )}
        </div>
        <div className="case-meta">
          <div>
            <span>Paciente</span>
            {p.name} · {p.age} años
          </div>
          <div>
            <span>Documento</span>
            {p.documentId}
          </div>
          <div>
            <span>Pagador</span>
            {payer.name} ({p.plan})
          </div>
          <div>
            <span>Canal</span>
            {CHANNEL_LABEL[payer.channel]}
          </div>
          <div>
            <span>Médico</span>
            {c.physician}
          </div>
          {c.payerReference && (
            <div>
              <span>Radicado</span>
              {c.payerReference}
            </div>
          )}
          {c.appointment && (
            <div>
              <span>Cita</span>
              <b style={{ color: 'var(--green)' }}>{c.appointment}</b>
            </div>
          )}
        </div>
        <div className="path">
          {HAPPY_PATH.map((s, i) => (
            <div key={s} className={`node ${i < pathIndex ? 'done' : i === pathIndex ? 'cur' : ''}`}>
              <i>{i < pathIndex ? '✓' : ''}</i>
              {STATUS_LABEL[s]}
            </div>
          ))}
        </div>
      </div>

      <div className="grid g-main" style={{ marginTop: 18 }}>
        <div className="grid" style={{ alignContent: 'start' }}>
          {/* ---- acciones según estado (State) */}
          <Card title="Siguiente paso">
            {c.status === 'DOCS_PENDING' && (
              <p className="note">El médico tiene una tarea en la HCE con los ítems faltantes. Complételos abajo para simularlo.</p>
            )}
            {c.status === 'CLINICAL_REVIEW' && (
              <div className="actions">
                <p className="note" style={{ width: '100%' }}>
                  Riesgo estimado {Math.round((c.riskScore ?? 0) * 100)} %. Revise la evidencia y valide la pertinencia clínica.
                </p>
                <button className="btn btn-blue" onClick={() => act((r) => wf.approveClinicalReview(r))}>
                  <Icon name="check" size={16} /> Validar y radicar
                </button>
              </div>
            )}
            {deferred && (
              <div className="actions">
                <div className="banner t-amber" style={{ width: '100%' }}>
                  <Icon name="alert" /> Portal de {payer.name} no disponible (circuito {breakerState(payer.id)}). La plataforma reintentará sola.
                </div>
                <button
                  className="btn btn-dark"
                  onClick={() => {
                    setBreaker(payer.id, 'cerrado');
                    act((r) => wf.submit(r));
                  }}
                >
                  Simular recuperación del portal y reintentar
                </button>
              </div>
            )}
            {c.status === 'SUBMITTED' && (
              <div className="actions">
                <p className="note" style={{ width: '100%' }}>
                  Seguimiento automático {c.channel === 'api' ? 'por webhook' : 'por bot cada 3 h'}. Simule la respuesta del pagador:
                </p>
                <button className="btn btn-blue" onClick={() => act((r) => wf.payerDecision(r, true))}>
                  Pagador aprueba
                </button>
                <select className="input" style={{ width: 230 }} value={category} onChange={(e) => setCategory(e.target.value as DenialCategory)}>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button className="btn btn-danger" onClick={() => act((r) => wf.payerDecision(r, false, category))}>
                  Pagador niega
                </button>
              </div>
            )}
            {c.status === 'DENIED' && c.denial && (
              <>
                <div className="grid g3" style={{ marginBottom: 14 }}>
                  <div>
                    <div className="note">Motivo</div>
                    <b style={{ fontSize: 14 }}>{CATEGORY_LABEL[c.denial.category]}</b>
                  </div>
                  <div>
                    <div className="note">P(revocar)</div>
                    <b style={{ fontSize: 14 }}>{Math.round(c.denial.reversalProbability * 100)} %</b>
                  </div>
                  <div>
                    <div className="note">Valor esperado</div>
                    <b style={{ fontSize: 14 }}>${expectedValue(c).toFixed(0)}</b>
                  </div>
                </div>
                {c.appeal ? (
                  <>
                    <textarea className="input draft" value={draft ?? c.appeal.draft} onChange={(e) => setDraft(e.target.value)} />
                    <div className="actions" style={{ marginTop: 12 }}>
                      <button className="btn btn-blue" onClick={() => act((r) => wf.signAppeal(r, draft ?? r.appeal!.draft))}>
                        <Icon name="send" size={16} /> Validar, firmar y radicar apelación
                      </button>
                      <button className="btn btn-ghost" onClick={() => act((r) => wf.closeDenial(r))}>
                        Cerrar sin apelar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="actions">
                    <p className="note" style={{ width: '100%' }}>
                      Valor esperado bajo el umbral: se recomienda cerrar y enviar el motivo al motor de reglas.
                    </p>
                    <button className="btn btn-dark" onClick={() => act((r) => wf.closeDenial(r))}>
                      Cerrar con aprendizaje
                    </button>
                  </div>
                )}
              </>
            )}
            {c.status === 'APPEALED' && (
              <div className="actions">
                <p className="note" style={{ width: '100%' }}>
                  Apelación radicada y llamada de revisión agendada. Simule el resultado:
                </p>
                <button className="btn btn-blue" onClick={() => act((r) => wf.appealOutcome(r, true))}>
                  Negación revocada
                </button>
                <button className="btn btn-ghost" onClick={() => act((r) => wf.appealOutcome(r, false))}>
                  Se mantiene → tutela
                </button>
              </div>
            )}
            {['SCHEDULED', 'APPROVED'].includes(c.status) && (
              <div className="banner t-green">
                <Icon name="check" /> Autorizado y agendado: {c.appointment}. El paciente fue notificado.
              </div>
            )}
            {c.status === 'CLOSED' && <p className="note">Caso cerrado.</p>}
          </Card>

          {c.dossier.length > 0 && (
            <Card title="Expediente clínico" extra={<small>{Math.round(completeness(c.dossier) * 100)} % completo</small>}>
              <Bar value={completeness(c.dossier)} good={completeness(c.dossier) === 1} />
              <div style={{ marginTop: 14 }}>
                {c.dossier.map((d) => (
                  <div className="evidence" key={d.code}>
                    <span className={`st ${d.status}`}>{d.status === 'missing' ? '!' : '✓'}</span>
                    <div className="meta">
                      <b>{d.label}</b>
                      {d.source && <div className="src">{d.source}</div>}
                      {d.excerpt && <div className="ex">{d.excerpt}</div>}
                      {d.status === 'missing' && c.status === 'DOCS_PENDING' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <input className="input" placeholder="Nota del médico…" value={notes[d.code] ?? ''} onChange={(e) => setNotes({ ...notes, [d.code]: e.target.value })} />
                          <button className="btn btn-dark btn-sm" onClick={() => act((r) => wf.provideEvidence(r, d.code, notes[d.code] ?? ''))}>
                            Completar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <Card title="Bitácora del caso" extra={<small>auditoría inmutable</small>}>
          <div className="timeline">
            {[...c.events].reverse().map((e) => (
              <div key={e.id} className={`ev ${e.actor === 'Gestor PA' || e.actor === 'Médico' ? 'human' : e.actor === 'IA' ? 'ia' : ''}`}>
                <div className="h">
                  <span>{fmtDate(e.at)}</span>
                  <b>{e.actor}</b>
                  <code>{e.type}</code>
                </div>
                <div className="d">{e.detail}</div>
              </div>
            ))}
          </div>
          <p className="note" style={{ marginTop: 6 }}>
            Toques humanos en este caso: <b>{c.humanTouches}</b>
          </p>
        </Card>
      </div>
    </>
  );
}
