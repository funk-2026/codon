import { useState } from 'react';
import { pulseData } from '../data/site';
import { useInView } from '../lib/hooks';

const keys = Object.keys(pulseData);
const N = pulseData[keys[0]].length;
const W = 640, H = 260, L = 38, R = 14, T = 16, B = 28, LO = 30, HI = 100;
const X = (i) => L + (i * (W - L - R)) / (N - 1);
const Y = (v) => T + ((HI - v) * (H - T - B)) / (HI - LO);

// Score trend on ECG paper: switch subject, hover for the value of each test.
export default function PulseChart() {
  const [cur, setCur] = useState(keys[0]);
  const [hover, setHover] = useState(null);
  const [ref, seen] = useInView(0.35);
  const v = pulseData[cur];
  const d = v.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p).toFixed(1)}`).join(' ');
  const weakest = keys.map((k) => [k, pulseData[k][N - 1]]).sort((a, b) => a[1] - b[1])[0][0];
  const draw = seen ? ' is-draw' : '';

  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(N - 1, Math.round(((px - L) / (W - L - R)) * (N - 1)))));
  };

  return (
    <div className="pulse" ref={ref} data-reveal>
      <div className="pulse__head">
        <span className="eyebrow">Accuracy per test</span>
        <div className="chips" role="group" aria-label="Subject">
          {keys.map((k) => <button key={k} className="chip" type="button" aria-pressed={cur === k} onClick={() => setCur(k)}>{k}</button>)}
        </div>
      </div>
      <div className="pulse__plot ecgpaper">
        <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart of accuracy across ten sample tests" onPointerMove={move} onPointerLeave={() => setHover(null)} onClick={move}>
          <defs>
            <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff5a3c" stopOpacity=".22" /><stop offset="1" stopColor="#ff5a3c" stopOpacity="0" /></linearGradient>
          </defs>
          {[40, 60, 80, 100].map((g) => (
            <g key={g}><line className="ax-line" x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} /><text className="axis" x={L - 8} y={Y(g) + 4} textAnchor="end">{g}%</text></g>
          ))}
          {v.map((_, i) => <text key={i} className="axis" x={X(i)} y={H - 6} textAnchor="middle">{i + 1}</text>)}
          <path key={`a-${cur}`} className={`area${draw}`} d={`${d} L${X(N - 1)} ${H - B} L${X(0)} ${H - B}Z`} />
          <path key={`t-${cur}`} className={`trend${draw}`} d={d} pathLength="1" />
          <line className="cursor-line" y1={T} y2={H - B} x1={hover == null ? 0 : X(hover)} x2={hover == null ? 0 : X(hover)} style={{ opacity: hover == null ? 0 : 1 }} />
          {v.map((p, i) => <circle key={i} className={`pt${i === N - 1 ? ' is-last' : ''}${hover === i ? ' is-on' : ''}`} r={i === N - 1 ? 6 : 5} cx={X(i)} cy={Y(p)} />)}
        </svg>
        <div className="pulse__tip" style={hover == null ? undefined : { opacity: 1, left: `${(X(hover) / W) * 100}%`, top: `${(Y(v[hover]) / H) * 100}%` }}>
          {hover != null && <>{v[hover]}%<small>Test {hover + 1} · {cur}</small></>}
        </div>
        </div>
        <span className="sample-tag pulse__tag">Sample data</span>
      </div>
      <div className="pulse__vitals">
        <div><span>Latest</span><b>{v[N - 1]}%</b></div>
        <div><span>Since test 1</span><b className="up">+{v[N - 1] - v[0]} pts</b></div>
        <div><span>Needs most work</span><b>{weakest}</b></div>
      </div>
    </div>
  );
}
