import { useEffect, useRef, useState } from 'react';
import { Ico } from './Art';
import { useInView } from '../lib/hooks';
import { fmt, reduceMotion } from '../lib/utils';

// Q Bank stopwatch: counts up, never ends the test
export function Stopwatch() {
  const [ref, seen] = useInView(0.4);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const id = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [seen]);
  return <span className="stopw" ref={ref}><Ico n="clock" /><span>{fmt(t)}</span></span>;
}

// Review timer: 2:00 per question, amber in the last 30 s. Shown at 10x speed so the demo is watchable.
export function ReviewTimer() {
  const [ref, seen] = useInView(0.4);
  const [left, setLeft] = useState(120);
  useEffect(() => {
    if (!seen || reduceMotion()) return;
    let raf, t0 = performance.now(), wait;
    const loop = (now) => {
      const p = Math.min(1, (now - t0) / 12000);
      setLeft(Math.ceil(120 * (1 - p)));
      if (p >= 1) { wait = setTimeout(() => { t0 = performance.now(); raf = requestAnimationFrame(loop); }, 1800); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearTimeout(wait); };
  }, [seen]);
  const msg = left === 0 ? '2 minutes up — next question' : left <= 30 ? 'Last 30 seconds — timer turns amber' : 'Counting down for this question';
  return (
    <div className="widget__viz" ref={ref}>
      <div className={`rt${left <= 30 && left > 0 ? ' is-amber' : ''}`}>
        <svg viewBox="0 0 40 40"><circle className="track" cx="20" cy="20" r="15.915" /><circle className="bar" cx="20" cy="20" r="15.915" pathLength="100" style={{ strokeDasharray: 100, strokeDashoffset: (1 - left / 120) * 100 }} /></svg>
        <div className="rt__t">{fmt(left)}</div>
      </div>
      <p className="rt__msg" aria-live="off">{msg}</p>
    </div>
  );
}

// Lecture PDFs: annotated notes unlock after 90% watched
export function PdfUnlock() {
  const [ref, seen] = useInView(0.6);
  const [open, setOpen] = useState(false);
  const bar = useRef(null);
  useEffect(() => {
    if (!seen) return;
    const ms = reduceMotion() ? 0 : 3300;
    bar.current.style.transition = `width ${reduceMotion() ? 0 : 3.2}s var(--ease)`;
    requestAnimationFrame(() => (bar.current.style.width = '92%'));
    const t = setTimeout(() => setOpen(true), ms);
    return () => clearTimeout(t);
  }, [seen]);
  return (
    <div className="widget__viz" ref={ref}>
      <div className="watchviz">
        <div className="pbar"><i ref={bar} /></div>
        <div className="row"><span><Ico n="doc" />Notes</span><span className="state is-open">Download</span></div>
        <div className="row"><span><Ico n="doc" />Annotated notes</span><span className={`state${open ? ' is-open' : ''}`}>{open ? 'Download' : <><Ico n="lock" />After 90%</>}</span></div>
      </div>
    </div>
  );
}
