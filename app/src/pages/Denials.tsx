import { APPEAL_THRESHOLD, CATEGORY_LABEL, expectedValue } from '../domain/appeals';
import { payerById, procedureByCups } from '../domain/payers';
import { patientById } from '../domain/seed';
import { Card, navigate, StatusPill } from '../components/ui';
import { useStore } from '../state/store';

export default function Denials() {
  const { cases } = useStore();
  const denied = cases.filter((c) => c.denial).sort((a, b) => expectedValue(b) - expectedValue(a));
  const open = denied.filter((c) => c.status === 'DENIED');
  const appealed = denied.filter((c) => c.appeal && c.appeal.status !== 'draft');
  const won = denied.filter((c) => c.appeal?.status === 'won');

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Negaciones y apelaciones</h1>
          <p>Las negaciones son un inventario con valor. Se trabajan en orden de valor esperado = P(revocar) × monto.</p>
        </div>
      </div>
      <div className="grid g4">
        <div className="card kpi hero-kpi">
          <div className="label">Valor esperado por recuperar</div>
          <div className="value">${Math.round(open.reduce((s, c) => s + expectedValue(c), 0)).toLocaleString('es-CO')}</div>
          <div className="delta">{open.length} negaciones abiertas</div>
        </div>
        <div className="card kpi">
          <div className="label">Apeladas</div>
          <div className="value">{denied.length ? Math.round(((appealed.length + open.filter((c) => c.appeal).length) / denied.length) * 100) : 0} %</div>
          <div className="delta">
            con borrador o radicadas · antes <b>41 %</b>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Revocadas</div>
          <div className="value">{won.length}</div>
          <div className="delta">de {appealed.length} apelaciones radicadas</div>
        </div>
        <div className="card kpi">
          <div className="label">Umbral de apelación</div>
          <div className="value">${APPEAL_THRESHOLD}</div>
          <div className="delta">o urgencia clínica (criterio de equidad)</div>
        </div>
      </div>
      <Card title="Cola priorizada" className="" extra={<small>orden: valor esperado</small>}>
        <table className="table">
          <thead>
            <tr>
              <th>Caso</th>
              <th>Paciente / servicio</th>
              <th>Motivo</th>
              <th>P(revocar)</th>
              <th>Monto</th>
              <th>Valor esperado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {denied.map((c) => (
              <tr className="click" key={c.id} onClick={() => navigate(`/app/casos/${c.id}`)}>
                <td>
                  <b>{c.id}</b>
                  <div className="sub">{payerById(c.payerId).name}</div>
                </td>
                <td>
                  {patientById(c.patientId).name}
                  <div className="sub">{procedureByCups(c.cups).name}</div>
                </td>
                <td>{CATEGORY_LABEL[c.denial!.category]}</td>
                <td>{Math.round(c.denial!.reversalProbability * 100)} %</td>
                <td>${procedureByCups(c.cups).amount.toLocaleString('es-CO')}</td>
                <td>
                  <b>${expectedValue(c).toFixed(0)}</b>
                </td>
                <td>
                  <StatusPill s={c.status} />
                  {c.status === 'DENIED' && c.appeal?.status === 'draft' && <div className="sub">Borrador IA listo</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
