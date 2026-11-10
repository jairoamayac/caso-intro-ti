import { Icon, ParticleWave } from '../components/ui';

const PAYER_WORDMARKS = ['Andina', 'Sabana Salud', 'Cumbre', 'Horizonte', 'Aurora', 'Cordillera'];

export default function Landing() {
  return (
    <div className="landing">
      <div className="landing-shell">
        <nav className="nav">
          <div className="logo">
            <span className="logo-mark" /> niágara·autoriza
          </div>
          <div className="nav-links">
            <a href="#producto">Producto</a>
            <a href="#como">Cómo funciona</a>
            <a href="#/app/valor">Valor</a>
            <a href="#/app/proceso">Proceso</a>
          </div>
          <a className="btn btn-dark" href="#/app">
            Abrir plataforma
          </a>
        </nav>

        <section className="hero">
          <ParticleWave />
          <div className="hero-steps" aria-hidden>
            <span className="on">1</span>
            <i />
            <span>2</span>
            <i />
            <span>3</span>
          </div>
          <div className="hero-content">
            <div className="eyebrow">Autorización previa, rediseñada</div>
            <h1>
              De 4,2 días <br />a <em>menos de 1,5.</em>
            </h1>
            <p className="lead">
              El expediente clínico se arma completo en el momento de la orden, se radica solo ante los 14 pagadores y las
              negaciones se apelan por su valor. Su equipo solo ve las excepciones.
            </p>
            <div className="hero-cta">
              <a className="btn btn-blue" href="#/app/nueva">
                Crear una solicitud <Icon name="arrow" size={16} />
              </a>
              <a className="play" href="#/app" aria-label="Ver el tablero">
                <Icon name="play" size={16} />
              </a>
            </div>
          </div>
          <div className="hero-cut">
            <a className="hero-card" href="#/app/valor" style={{ display: 'block' }}>
              <h4>
                Ver el impacto <Icon name="arrow" />
              </h4>
              <div className="row">
                <div className="avatars">
                  <span style={{ background: '#1f5eff' }}>EPS</span>
                  <span style={{ background: '#45cdff' }}>PRE</span>
                  <span style={{ background: '#0a1a5c' }}>SIS</span>
                </div>
                <div>
                  <b style={{ fontSize: 13 }}>$2,85 M al año</b>
                  <small>Valor esperado del escenario base para Niágara.</small>
                </div>
              </div>
            </a>
          </div>
        </section>

        <div className="strip">
          <div className="strip-pill">
            <b>14</b> pagadores · <b>1</b> sola plataforma
          </div>
          <div className="payer-logos">
            {PAYER_WORDMARKS.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </div>

        <section className="section" id="producto">
          <div className="section-head">
            <div>
              <h2>Lo que cambia</h2>
              <p>Metas a 12 meses frente a la operación actual.</p>
            </div>
            <a className="btn btn-dark btn-sm" href="#/app/valor">
              Simular <Icon name="arrow" size={14} />
            </a>
          </div>
          <div className="metric-cards">
            {[
              { big: '1,0 h', t: 'Tiempo por solicitud', s: 'Hoy 2,6 h · referencia 0,8–1,2 h', chip: '−61 %', bg: 'linear-gradient(140deg,#45cdff,#1f5eff 60%,#0a1a5c)' },
              { big: '15 %', t: 'Con seguimiento documental', s: 'Hoy 68 % · 2,3 llamadas por caso', chip: '−53 pp', bg: 'linear-gradient(160deg,#0a1a5c,#1f5eff 70%,#7fd8ff)' },
              { big: '85 %', t: 'Negaciones apeladas', s: 'Hoy 41 % · 59 % se abandonan', chip: '+44 pp', bg: 'linear-gradient(120deg,#7fd8ff,#2f7bff 50%,#050d33)' },
            ].map((m, i) => (
              <div className="metric-card" key={m.t}>
                <div className="art" style={{ background: m.bg }}>
                  <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
                    <defs>
                      <pattern id={`dots${i}`} width="14" height="14" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1.3" fill="#fff" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#dots${i})`} />
                  </svg>
                  <div className="big">{m.big}</div>
                </div>
                <div className="body">
                  <div>
                    <h3>{m.t}</h3>
                    <small>{m.s}</small>
                  </div>
                  <span className="chip">{m.chip}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="como">
          <div className="center-head">
            <h2>La autorización, simplificada</h2>
            <p>La plataforma hace lo administrativo. Las personas hacen el juicio clínico.</p>
          </div>
          <div className="steps3">
            <div className="step-card left">
              <div className="ic">
                <Icon name="doc" />
              </div>
              <div>
                <h3>Captura la orden</h3>
                <p>Desde la historia clínica o por fax con OCR. Verifica elegibilidad y la regla de cada pagador al instante.</p>
              </div>
            </div>
            <div className="step-card mid">
              <div className="orb" />
              <div className="ic">
                <Icon name="sparkle" />
              </div>
              <div>
                <h3>Expediente completo con IA</h3>
                <p>
                  Extrae la evidencia de la HCE con cita a la fuente y le pide al médico solo lo que falta. Nada se radica
                  incompleto.
                </p>
                <a href="#/app/nueva" style={{ display: 'inline-flex', gap: 6, marginTop: 18, fontSize: 12, fontWeight: 700, letterSpacing: '.08em' }}>
                  PROBAR <Icon name="arrow" size={14} />
                </a>
              </div>
            </div>
            <div className="step-card right">
              <div className="ic">
                <Icon name="send" />
              </div>
              <div>
                <h3>Radica, sigue y apela</h3>
                <p>API o bot por pagador, seguimiento con SLA, autoagenda y apelaciones redactadas con evidencia.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="feature">
            <div className="feature-art">
              <svg viewBox="0 0 340 380" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <circle key={i} cx={170} cy={190} r={30 + i * 22} fill="none" stroke="rgba(255,255,255,.12)" />
                ))}
                <rect x="70" y="120" width="200" height="140" rx="18" fill="rgba(255,255,255,.95)" />
                <rect x="90" y="142" width="90" height="10" rx="5" fill="#1f5eff" />
                {[0, 1, 2, 3].map((i) => (
                  <g key={i}>
                    <circle cx="98" cy={176 + i * 20} r="6" fill={i < 3 ? '#12a46b' : '#c98200'} />
                    <rect x="112" y={172 + i * 20} width={130 - i * 12} height="8" rx="4" fill="#dfe5f0" />
                  </g>
                ))}
              </svg>
            </div>
            <div className="feature-big" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div>Expediente</div>
              <div className="r">completo desde</div>
              <div>la orden médica</div>
              <p style={{ fontSize: 14, textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'var(--muted)', marginTop: 18, maxWidth: 460 }}>
                Calidad en la fuente: el 68 % de las solicitudes que hoy persiguen documentos por teléfono se resuelve antes de
                radicar.
              </p>
            </div>
          </div>
          <div className="feature-row">
            <div className="offer">
              <b>+662</b>
              <small>
                pacientes al año que hoy abandonan
                <br />y que sí recibirían atención.
              </small>
            </div>
            <a className="cta-bar" href="#/app">
              Abrir la plataforma <Icon name="arrow" />
            </a>
          </div>
        </section>

        <footer className="footer">
          <span>Niágara Autoriza · MVP académico · caso ficticio, datos sintéticos</span>
          <span>Documentación en /docs</span>
        </footer>
      </div>
    </div>
  );
}
