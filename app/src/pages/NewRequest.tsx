import { useMemo, useState } from 'react';
import { CHANNEL_LABEL, payerById, policyFor, PROCEDURES, procedureByCups } from '../domain/payers';
import { PATIENTS, PHYSICIANS, patientById } from '../domain/seed';
import { completeness, extractEvidence, needsClinicalReview, RuleBasedScorer } from '../domain/scoring';
import type { AuthorizationRequest, EvidenceItem } from '../domain/types';
import * as wf from '../domain/workflow';
import { Bar, Card, Icon, navigate } from '../components/ui';
import { useStore } from '../state/store';

export default function NewRequest() {
  const { upsert } = useStore();
  const [patientId, setPatientId] = useState('p1');
  const [cups, setCups] = useState('883522');
  const [physician, setPhysician] = useState(PHYSICIANS[0]);
  const [urgency, setUrgency] = useState<AuthorizationRequest['urgency']>('rutina');
  const [channel, setChannel] = useState<'HCE' | 'Fax (OCR)'>('HCE');
  const [scan, setScan] = useState<'idle' | 'running' | 'done'>('idle');
  const [shown, setShown] = useState(0);
  const [dossier, setDossier] = useState<EvidenceItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const patient = patientById(patientId);
  const payer = payerById(patient.payerId);
  const proc = procedureByCups(cups);
  const policy = useMemo(() => policyFor(patient.payerId, cups), [patient.payerId, cups]);

  const reset = () => {
    setScan('idle');
    setShown(0);
    setDossier([]);
    setNotes({});
  };

  const runExtraction = () => {
    const items = extractEvidence(patient, policy.evidence);
    setDossier(items);
    setScan('running');
    setShown(0);
    items.forEach((_, i) => setTimeout(() => setShown(i + 1), 450 * (i + 1)));
    setTimeout(() => setScan('done'), 450 * items.length + 200);
  };

  const provide = (code: string) =>
    setDossier((d) => d.map((x) => (x.code === code ? { ...x, status: 'provided', source: 'Aportado por el médico', excerpt: notes[code] ? `"${notes[code]}"` : undefined } : x)));

  const comp = completeness(dossier);
  const risk = dossier.length ? RuleBasedScorer.score({ payerId: patient.payerId, cups, dossier, urgency }) : 0;

  const create = () => {
    let r = wf.createRequest({ patientId, cups, physician, urgency }, channel);
    // aplicar lo que el médico ya completó en pantalla (mismo caso de uso que en la HCE)
    for (const item of dossier.filter((d) => d.status === 'provided')) r = wf.provideEvidence(r, item.code, notes[item.code] ?? '');
    upsert(r);
    navigate(`/app/casos/${r.id}`);
  };

  const step = scan === 'idle' ? 1 : comp < 1 ? 2 : 3;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Nueva solicitud</h1>
          <p>Así lo vería el médico dentro de la historia clínica al ordenar el servicio.</p>
        </div>
      </div>

      <div className="stepper">
        {['Orden y regla del pagador', 'Expediente con IA', 'Radicar'].map((t, i) => (
          <div key={t} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}>
            <span>{step > i + 1 ? '✓' : i + 1}</span> {t}
          </div>
        ))}
      </div>

      <div className="grid g-main">
        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="1 · Orden médica">
            <div className="grid g2">
              <div className="field">
                <label>Paciente</label>
                <select className="input" value={patientId} onChange={(e) => (setPatientId(e.target.value), reset())}>
                  {PATIENTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {payerById(p.payerId).name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Servicio (CUPS)</label>
                <select className="input" value={cups} onChange={(e) => (setCups(e.target.value), reset())}>
                  {PROCEDURES.map((p) => (
                    <option key={p.cups} value={p.cups}>
                      {p.cups} · {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Médico</label>
                <select className="input" value={physician} onChange={(e) => setPhysician(e.target.value)}>
                  {PHYSICIANS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Urgencia · canal de entrada</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="input" value={urgency} onChange={(e) => setUrgency(e.target.value as typeof urgency)}>
                    <option value="rutina">Rutina</option>
                    <option value="prioritaria">Prioritaria</option>
                    <option value="urgente">Urgente</option>
                  </select>
                  <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
                    <option>HCE</option>
                    <option>Fax (OCR)</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="2 · Expediente clínico"
            extra={
              policy.requiresPA && (
                <button className="btn btn-soft btn-sm" onClick={runExtraction} disabled={scan === 'running'}>
                  <Icon name="sparkle" size={14} /> {scan === 'idle' ? 'Extraer evidencia con IA' : 'Volver a extraer'}
                </button>
              )
            }
          >
            {!policy.requiresPA && (
              <div className="banner t-green">
                <Icon name="check" /> Este servicio no requiere autorización previa para {payer.name}. Se agenda directamente.
              </div>
            )}
            {policy.requiresPA && scan === 'idle' && (
              <div className="empty">
                La IA buscará en la HCE los {policy.evidence.length} soportes que exige {payer.name} y citará la fuente de cada uno.
              </div>
            )}
            {dossier.slice(0, shown).map((d) => (
              <div className="evidence" key={d.code}>
                <span className={`st ${d.status}`}>{d.status === 'missing' ? '!' : '✓'}</span>
                <div className="meta">
                  <b>{d.label}</b>
                  {d.status !== 'missing' && (
                    <>
                      <div className="src">
                        {d.source}
                        {d.confidence && d.confidence < 1 ? ` · confianza ${(d.confidence * 100).toFixed(0)} %` : ''}
                      </div>
                      {d.excerpt && <div className="ex">{d.excerpt}</div>}
                    </>
                  )}
                  {d.status === 'missing' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        className="input"
                        placeholder="Complete aquí (texto sugerido por IA editable)…"
                        value={notes[d.code] ?? ''}
                        onChange={(e) => setNotes({ ...notes, [d.code]: e.target.value })}
                      />
                      <button className="btn btn-dark btn-sm" onClick={() => provide(d.code)}>
                        Adjuntar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {scan === 'running' && shown < dossier.length && <div className="empty scanning">Leyendo historia clínica…</div>}
          </Card>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="rule-box">
            <div className="k">Regla aplicada · {policy.policyVersion}</div>
            <div className="v" style={{ fontSize: 18 }}>
              {payer.name} × {proc.name}
            </div>
            <div className="rule-grid">
              <div>
                <div className="k">¿Requiere PA?</div>
                <div className="v">{policy.requiresPA ? 'Sí' : 'No'}</div>
              </div>
              <div>
                <div className="k">SLA del pagador</div>
                <div className="v">{policy.slaHours ? `${policy.slaHours} h` : '—'}</div>
              </div>
              <div>
                <div className="k">Canal de radicación</div>
                <div className="v">{CHANNEL_LABEL[payer.channel]}</div>
              </div>
              <div>
                <div className="k">Valor del servicio</div>
                <div className="v">${proc.amount.toLocaleString('es-CO')}</div>
              </div>
            </div>
          </div>

          <Card title="3 · Listo para radicar">
            {policy.requiresPA ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>Completitud del expediente</span>
                  <b>{scan === 'idle' ? '—' : `${Math.round(comp * 100)} %`}</b>
                </div>
                <Bar value={scan === 'idle' ? 0 : comp} good={comp === 1} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, margin: '16px 0 6px' }}>
                  <span>Riesgo de negación estimado</span>
                  <b>{scan === 'idle' ? '—' : `${Math.round(risk * 100)} %`}</b>
                </div>
                <Bar value={scan === 'idle' ? 0 : risk} />
                {scan === 'done' && comp === 1 && needsClinicalReview(risk, cups) && (
                  <p className="note" style={{ marginTop: 12 }}>
                    Irá primero a <b>revisión clínica</b> ({proc.highCost ? 'alto costo' : 'riesgo alto'}).
                  </p>
                )}
                {scan === 'done' && comp < 1 && (
                  <p className="note" style={{ marginTop: 12 }}>
                    Puede crearla ahora: quedará en <b>Faltan documentos</b> y el médico recibirá solo los ítems pendientes.
                  </p>
                )}
              </>
            ) : (
              <p className="note">Se creará y agendará automáticamente.</p>
            )}
            <button className="btn btn-blue" style={{ marginTop: 18, width: '100%', justifyContent: 'center' }} onClick={create} disabled={policy.requiresPA && scan !== 'done'}>
              {policy.requiresPA ? (comp === 1 ? 'Crear y radicar' : 'Crear solicitud') : 'Crear y agendar'} <Icon name="arrow" size={16} />
            </button>
            <p className="note" style={{ marginTop: 10 }}>
              Antes: 2,3 llamadas por caso para conseguir esta información.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
