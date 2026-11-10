import { useState } from 'react';
import { AS_IS, computeValue, SCENARIOS, usd, type ValueInputs } from '../domain/value';
import { Card } from '../components/ui';

type Key = keyof ValueInputs;
const SLIDERS: { k: Key; label: string; min: number; max: number; step: number; fmt: (v: number) => string }[] = [
  { k: 'monthlyVolume', label: 'Solicitudes al mes', min: 1500, max: 4000, step: 100, fmt: (v) => v.toLocaleString('es-CO') },
  { k: 'denialRate', label: 'Tasa de negación inicial (hoy 18,4 %)', min: 0.06, max: 0.2, step: 0.005, fmt: (v) => `${(v * 100).toFixed(1)} %` },
  { k: 'appealRate', label: '% de negaciones apeladas (hoy 41 %)', min: 0.4, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)} %` },
  { k: 'appealSuccess', label: 'Éxito de apelación (hoy 31 %)', min: 0.25, max: 0.5, step: 0.01, fmt: (v) => `${Math.round(v * 100)} %` },
  { k: 'abandonRate', label: 'Abandono de pacientes (hoy 3,8 %)', min: 0.005, max: 0.038, step: 0.001, fmt: (v) => `${(v * 100).toFixed(1)} %` },
  { k: 'coordinatorsReduced', label: 'Coordinadores no reemplazados (rotación)', min: 0, max: 8, step: 1, fmt: (v) => `${v}` },
  { k: 'amountPerCase', label: 'Monto neto por caso (USD)', min: 400, max: 900, step: 10, fmt: (v) => `$${v}` },
];

const COLORS = { lab: '#0a1a5c', den: '#1f5eff', abd: '#45cdff', rot: '#9db8ff' };

export default function Value() {
  const [name, setName] = useState<keyof typeof SCENARIOS>('Base');
  const [inp, setInp] = useState<ValueInputs>(SCENARIOS.Base);
  const v = computeValue(inp);
  const parts = [
    { k: 'lab', label: 'Capacidad laboral realizada', val: v.labor },
    { k: 'den', label: 'Ingresos por negaciones', val: v.denials },
    { k: 'abd', label: 'Ingresos por menor abandono', val: v.abandonment },
    { k: 'rot', label: 'Menor rotación', val: v.rotation },
  ] as const;
  const max = Math.max(...parts.map((p) => p.val), 1);
  const invest = 685_000;
  const run = 275_000;
  const net3 = v.total * 0.4 + v.total * 2 - invest - run * 2;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Valor para Niágara</h1>
          <p>Simulador con las fórmulas del documento 05. Mueva los supuestos y vea el impacto anual.</p>
        </div>
        <div className="tabs">
          {(Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[]).map((s) => (
            <button
              key={s}
              className={name === s ? 'on' : ''}
              onClick={() => {
                setName(s);
                setInp(SCENARIOS[s]);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid g4">
        <div className="card kpi hero-kpi">
          <div className="label">Beneficio anual</div>
          <div className="value">{usd(v.total)}</div>
          <div className="delta">régimen, después de la rampa</div>
        </div>
        <div className="card kpi">
          <div className="label">Neto a 3 años</div>
          <div className="value">{usd(net3)}</div>
          <div className="delta">inversión $685 k + $275 k/año</div>
        </div>
        <div className="card kpi">
          <div className="label">Pacientes más atendidos/año</div>
          <div className="value">+{Math.round(v.patientsRecovered).toLocaleString('es-CO')}</div>
          <div className="delta">hoy abandonan ~1.095</div>
        </div>
        <div className="card kpi">
          <div className="label">Costo del equipo PA</div>
          <div className="value">−{Math.round(v.teamCostReductionPct * 100)} %</div>
          <div className="delta">
            meta estratégica <b>−12 %</b> no clínico
          </div>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 18 }}>
        <Card title="Supuestos">
          <div className="grid" style={{ gap: 16 }}>
            {SLIDERS.map((s) => (
              <div className="slider" key={s.k}>
                <div className="top">
                  <span>{s.label}</span>
                  <b>{s.fmt(inp[s.k])}</b>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={inp[s.k]} onChange={(e) => setInp({ ...inp, [s.k]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
        </Card>
        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Composición del beneficio anual">
            <div className="bars">
              {parts.map((p) => (
                <div className="hbar" key={p.k}>
                  <div className="lbl">
                    <span>{p.label}</span>
                    <b>{usd(p.val)}</b>
                  </div>
                  <div className="track">
                    <i style={{ width: `${(Math.max(0, p.val) / max) * 100}%`, background: COLORS[p.k] }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Ingresos perdidos por negaciones">
            <div className="bars">
              {[
                { l: `Hoy (negación ${(AS_IS.denialRate * 100).toFixed(1)} %, apelación 41 %, éxito 31 %)`, val: v.asIsLost, c: '#e0424f' },
                { l: 'Con la plataforma', val: v.toBeLost, c: '#12a46b' },
              ].map((r) => (
                <div className="hbar" key={r.l}>
                  <div className="lbl">
                    <span>{r.l}</span>
                    <b>{usd(r.val)}</b>
                  </div>
                  <div className="track">
                    <i style={{ width: `${(r.val / v.asIsLost) * 100}%`, background: r.c }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="note" style={{ marginTop: 14 }}>
              Supuestos: $620 por caso, $1.005 por paciente, $120 k por coordinador. Las inconsistencias del caso se explican en docs/01 §2.1.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
