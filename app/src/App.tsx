import { lazy, Suspense } from 'react';
import { Icon, useRoute } from './components/ui';
import CaseDetail from './pages/CaseDetail';
import Dashboard from './pages/Dashboard';
import Denials from './pages/Denials';
import Landing from './pages/Landing';
import NewRequest from './pages/NewRequest';
import Value from './pages/Value';
import { StoreProvider, useStore } from './state/store';

const Process = lazy(() => import('./pages/Process'));

const LINKS = [
  { to: '/app', label: 'Tablero', icon: 'grid' },
  { to: '/app/nueva', label: 'Nueva solicitud', icon: 'plus' },
  { to: '/app/negaciones', label: 'Negaciones', icon: 'shield' },
  { to: '/app/proceso', label: 'Proceso BPMN', icon: 'flow' },
  { to: '/app/valor', label: 'Valor', icon: 'chart' },
];

function Shell({ route }: { route: string }) {
  const { cases, reset } = useStore();
  const pendingDenials = cases.filter((c) => c.status === 'DENIED').length;
  const caseMatch = route.match(/^\/app\/casos\/(.+)$/);
  let page;
  if (caseMatch) page = <CaseDetail id={caseMatch[1]} />;
  else if (route === '/app/nueva') page = <NewRequest />;
  else if (route === '/app/negaciones') page = <Denials />;
  else if (route === '/app/proceso') page = <Process />;
  else if (route === '/app/valor') page = <Value />;
  else page = <Dashboard />;

  return (
    <div className="app">
      <aside className="sidebar">
        <a className="logo" href="#/">
          <span className="logo-mark" /> niágara·autoriza
        </a>
        {LINKS.map((l) => {
          const on = l.to === '/app' ? route === '/app' || !!caseMatch : route.startsWith(l.to);
          return (
            <a key={l.to} href={`#${l.to}`} className={`side-link ${on ? 'on' : ''}`}>
              <Icon name={l.icon} /> {l.label}
              {l.to === '/app/negaciones' && pendingDenials > 0 && <span className="count">{pendingDenials}</span>}
            </a>
          );
        })}
        <a className="side-link" href="#/">
          <Icon name="home" /> Inicio
        </a>
        <div className="side-foot">
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,.08)', color: '#fff', marginBottom: 10 }} onClick={reset}>
            <Icon name="reset" size={14} /> Reiniciar demo
          </button>
          <div>Gestor clínico PA · Sede Norte</div>
          <div>Datos sintéticos</div>
        </div>
      </aside>
      <main className="main">
        <Suspense fallback={<div className="empty">Cargando…</div>}>{page}</Suspense>
      </main>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  if (!route.startsWith('/app')) return <Landing />;
  return (
    <StoreProvider>
      <Shell route={route} />
    </StoreProvider>
  );
}
