import { useEffect, useRef, useState } from 'react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import asIs from '../../../docs/bpmn/as-is.bpmn?raw';
import toBe from '../../../docs/bpmn/to-be.bpmn?raw';
import { Card } from '../components/ui';

const ROWS = [
  ['Tiempo por solicitud', '2,6 h', '≤ 1,0 h'],
  ['Días hasta decisión', '4,2', '≤ 1,5'],
  ['Seguimiento documental', '68 %', '≤ 15 %'],
  ['Radicación manual', '71 %', '≤ 20 %'],
  ['Negación inicial', '18,4 %', '≤ 11 %'],
  ['Negaciones apeladas', '41 %', '≥ 85 %'],
  ['Abandono de pacientes', '3,8 %', '≤ 1,5 %'],
  ['Satisfacción médica', '3,8 / 10', '≥ 7 / 10'],
];

export default function Process() {
  const [tab, setTab] = useState<'to-be' | 'as-is'>('to-be');
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setErr('');
    const viewer = new NavigatedViewer({ container: ref.current! });
    viewer
      .importXML(tab === 'to-be' ? toBe : asIs)
      .then(() => alive && (viewer.get('canvas') as { zoom: (z: string) => void }).zoom('fit-viewport'))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
      viewer.destroy();
    };
  }, [tab]);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Proceso BPMN</h1>
          <p>Modelo ejecutable del proceso. Arrastre para mover, rueda para hacer zoom.</p>
        </div>
        <div className="tabs">
          <button className={tab === 'to-be' ? 'on' : ''} onClick={() => setTab('to-be')}>
            TO-BE · rediseñado
          </button>
          <button className={tab === 'as-is' ? 'on' : ''} onClick={() => setTab('as-is')}>
            AS-IS · actual
          </button>
        </div>
      </div>
      <div className="bpmn-wrap" ref={ref} />
      {err && <div className="banner t-red" style={{ marginTop: 12 }}>{err}</div>}
      <div className="grid g2" style={{ marginTop: 18 }}>
        <Card title="Indicadores AS-IS → TO-BE">
          <table className="table">
            <thead>
              <tr>
                <th>KPI</th>
                <th>AS-IS</th>
                <th>Meta TO-BE</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, a, b]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td style={{ color: 'var(--red)' }}>{a}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 700 }}>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Qué cambia en el diseño">
          <div className="list">
            {[
              ['Calidad en la fuente', 'El expediente se arma al ordenar, no se persigue después.'],
              ['Toca una vez', 'El médico interviene una sola vez, dentro de la HCE, solo si falta algo.'],
              ['Sin humanos en lo administrativo', 'Elegibilidad, radicación y seguimiento automáticos (API/RPA).'],
              ['Humanos en el juicio clínico', 'Revisión de riesgo alto, firma de apelaciones, tutela acompañada.'],
              ['Negaciones con valor', 'Se priorizan por valor esperado y alimentan las reglas.'],
            ].map(([t, d]) => (
              <div className="task" key={t}>
                <span className="txt">
                  <b>{t}</b>
                  <span style={{ whiteSpace: 'normal' }}>{d}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
