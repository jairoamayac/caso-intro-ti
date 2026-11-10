import { useEffect, useRef, useState, type ReactNode } from 'react';
import { STATUS_LABEL, STATUS_TONE } from '../domain/stateMachine';
import type { RequestStatus } from '../domain/types';

// ---------- router por hash
export function useRoute() {
  const [hash, setHash] = useState(() => location.hash.slice(1) || '/');
  useEffect(() => {
    const on = () => {
      setHash(location.hash.slice(1) || '/');
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
}
export const navigate = (to: string) => (location.hash = to);

// ---------- íconos (trazo simple)
const paths: Record<string, string> = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  plus: 'M12 5v14M5 12h14',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  flow: 'M5 6h6v4H5zM13 14h6v4h-6zM8 10v4h8',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 18l-6-6 6-6',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  send: 'M4 12l16-8-6 16-3-7z',
  play: 'M8 5v14l11-7z',
  check: 'M5 12l5 5L20 7',
  alert: 'M12 8v5M12 16v.5M3 20h18L12 4z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  scale: 'M12 3v18M5 7h14M5 7l-3 7h6zM19 7l-3 7h6z',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z',
  home: 'M3 11l9-7 9 7v9H3z',
  reset: 'M4 4v6h6M20 20v-6h-6M5 15a8 8 0 0013 3M19 9A8 8 0 006 6',
};
export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

export function StatusPill({ s }: { s: RequestStatus }) {
  return <span className={`pill t-${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>;
}

export function Bar({ value, good }: { value: number; good?: boolean }) {
  return (
    <div className={`bar ${good ? 'good' : ''}`}>
      <i style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function Card({ title, extra, children, className = '' }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <h3>
          <span>{title}</span>
          {extra}
        </h3>
      )}
      {children}
    </div>
  );
}

export const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
};

export const fmtDate = (t: number) =>
  new Date(t).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Onda de partículas animada (inspirada en la referencia "Technology background"). */
export function ParticleWave() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    let t = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 2);
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener('resize', resize);
    const draw = () => {
      const w = c.clientWidth;
      const h = c.clientHeight;
      ctx.clearRect(0, 0, w, h);
      // grilla de puntos tenue arriba-izquierda
      for (let x = 20; x < w * 0.55; x += 22) {
        for (let y = 20; y < h * 0.45; y += 22) {
          const a = 0.05 + 0.12 * (1 - x / (w * 0.55)) * (1 - y / (h * 0.45));
          ctx.fillStyle = `rgba(120,170,255,${a})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // onda de partículas
      const cols = 90;
      const rows = 26;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const u = i / cols;
          const v = j / rows;
          const x = w * 0.18 + u * w * 0.95;
          const base = h * 0.62 + (v - 0.5) * h * 0.55 * (0.35 + u * 0.8);
          const y = base + Math.sin(u * 5 + t + v * 2) * 38 * (0.4 + u) + Math.cos(u * 3 - t * 0.7) * 18;
          const glow = Math.exp(-((u - 0.55) ** 2) / 0.08) * Math.exp(-((v - 0.5) ** 2) / 0.12);
          const a = 0.12 + 0.75 * glow;
          ctx.fillStyle = `rgba(${90 + 80 * glow},${190 + 50 * glow},255,${a})`;
          ctx.beginPath();
          ctx.arc(x, y, 0.8 + 1.4 * glow, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!reduce) {
        t += 0.012;
        raf = requestAnimationFrame(draw);
      }
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={ref} aria-hidden />;
}
