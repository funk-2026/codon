import { useEffect, useState } from 'react';
import { useInView } from '../lib/hooks';
import { reduceMotion } from '../lib/utils';
import { mastery } from '../data/site';

// Progress ring (CSS animates --off from 100 to its value)
export const Ring = ({ off = 30, n, small, style }) => (
  <div className="ring" style={{ '--off': off, ...style }}>
    <svg viewBox="0 0 40 40">
      <circle className="track" cx="20" cy="20" r="15.915" pathLength="100" />
      <circle className="bar" cx="20" cy="20" r="15.915" pathLength="100" />
    </svg>
    <div className="ring__n">{n}<small>{small}</small></div>
  </div>
);

// Counts up when scrolled into view
export function Counter({ end, suffix = '' }) {
  const [ref, seen] = useInView(0.6);
  const [v, setV] = useState(reduceMotion() ? end : 0);
  useEffect(() => {
    if (!seen || reduceMotion()) { if (reduceMotion()) setV(end); return; }
    let raf; const t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / 1600); setV(Math.round(end * (1 - Math.pow(1 - p, 4)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, end]);
  return <span ref={ref}>{v}{suffix}</span>;
}

const tcls = { g: 't-g', a: 't-a', r: 't-r', n: 't-n' };
export const MasteryTiles = ({ count = 32, step = 1 }) => (
  <>{Array.from({ length: count }, (_, i) => <i key={i} className={`tile ${tcls[mastery[(i * step) % 32]]}`} />)}</>
);

// Header block used at the top of inner pages
export const Eyebrow = ({ children, num = '—', reveal = true, style }) => (
  <p className="eyebrow" data-reveal={reveal ? '' : undefined} style={style}><b>{num}</b>{children}</p>
);
