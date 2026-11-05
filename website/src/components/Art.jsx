// Small generated SVG pieces: the medical motifs used across the site.

// Vertical DNA double helix that loops seamlessly (CSS moves it by exactly one period).
export function Helix({ w = 140, periods = 2, lam = 220, amp = 46, className = '' }) {
  const total = (periods + 1) * lam;
  const strand = (ph) => {
    let d = '';
    for (let y = 0; y <= total; y += 5) d += `${y ? 'L' : 'M'}${(w / 2 + amp * Math.sin((2 * Math.PI * y) / lam + ph)).toFixed(1)} ${y} `;
    return d;
  };
  const rungs = [];
  for (let y = 0; y <= total; y += lam / 10) {
    const a = (2 * Math.PI * y) / lam;
    rungs.push(<line key={y} x1={(w / 2 + amp * Math.sin(a)).toFixed(1)} y1={y} x2={(w / 2 - amp * Math.sin(a)).toFixed(1)} y2={y} strokeOpacity={(0.15 + Math.abs(Math.cos(a)) * 0.7).toFixed(2)} />);
  }
  return (
    <svg className={`helix ${className}`} viewBox={`0 0 ${w} ${periods * lam}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <g className="helix__spin" style={{ '--lam': lam }}>
        <g>{rungs}</g>
        <path d={strand(0)} />
        <path d={strand(Math.PI)} />
      </g>
    </svg>
  );
}

// ECG trace: a faint full line plus a bright pulse that travels along it.
export function Ecg({ beats = 4, w = 1200, h = 120, y0 = 62 }) {
  const seg = w / beats;
  let d = `M0 ${y0}`;
  for (let i = 0; i < beats; i++) {
    const x = i * seg, f = (n) => (x + seg * n).toFixed(1);
    d += ` L${f(0.16)} ${y0} q${(seg * 0.04).toFixed(1)} -11 ${(seg * 0.08).toFixed(1)} 0`;
    d += ` L${f(0.38)} ${y0} L${f(0.41)} ${y0 + 9} L${f(0.455)} ${y0 - 54} L${f(0.5)} ${y0 + 28} L${f(0.53)} ${y0}`;
    d += ` L${f(0.64)} ${y0} q${(seg * 0.06).toFixed(1)} -17 ${(seg * 0.12).toFixed(1)} 0 L${f(1)} ${y0}`;
  }
  return (
    <svg className="ecg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="base" d={d} pathLength="1" />
      <path className="live" d={d} pathLength="1" />
    </svg>
  );
}

const P = {
  heart: <><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2C10.5 3.5 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" /><path d="M3.2 12h6.3l.5-1 2 4.5 2-7 1.5 3.5h5.3" /></>,
  steth: <><path d="M11 2v2M5 2v2" /><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" /><path d="M8 15a6 6 0 0 0 12 0v-3" /><circle cx="20" cy="10" r="2" /></>,
  cross: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" />,
  flame: <path d="M12 2.5c.3 3-1.2 4.6-2.7 6.3C7.9 10.3 6.5 12 6.5 14.5c0 3.2 2.3 5.5 5.5 5.5s5.5-2.3 5.5-5.5c0-1.8-.8-3.1-1.7-4.2-.3 1.1-.9 1.8-1.7 2.2.5-3.7-.3-7.5-1.1-10Z" />,
  clock: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  doc: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="m10 8.5 5 3.5-5 3.5Z" /></>,
  cards: <><rect x="3" y="6" width="14" height="14" rx="2" /><path d="M7 6V4a1 1 0 0 1 1-1h11a2 2 0 0 1 2 2v11a1 1 0 0 1-1 1h-2" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m7 15 4-5 3 3 5-7" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4Z" />,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  mind: <path d="M12 21c-5-3.5-8-6.5-8-10.5A4.5 4.5 0 0 1 8.5 6c1.4 0 2.7.7 3.5 1.8A4.3 4.3 0 0 1 15.5 6 4.5 4.5 0 0 1 20 10.5c0 4-3 7-8 10.5Z" />,
  strike: <><path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><path d="M4 12h16" /></>,
  arrow: <path d="M3 12h18M14 5l7 7-7 7" />,
};

export const Ico = ({ n }) => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {P[n]}
  </svg>
);

export const Arrow = () => (
  <svg className="arr" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
