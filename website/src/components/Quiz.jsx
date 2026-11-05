import { useEffect, useRef, useState } from 'react';
import { quizQuestions as Q, site } from '../data/site';
import { fmt, reduceMotion } from '../lib/utils';
import { useInView } from '../lib/hooks';
import { Arrow, Ico } from './Art';

const blank = () => ({ i: 0, ans: Q.map(() => null), conf: Q.map(() => null), strike: Q.map(() => []), done: false });

// A real, playable 3-question sample test: cross out options, tag confidence, get a NEET-marked result.
export default function Quiz() {
  const [st, setSt] = useState(blank);
  const [sec, setSec] = useState(0);
  const [ref, seen] = useInView(0.3);
  const [swap, setSwap] = useState(0);
  const [ringOff, setRingOff] = useState(100);

  // stopwatch counts up while the test is open (like an untimed Q Bank test)
  useEffect(() => {
    if (!seen || st.done) return;
    const t = setInterval(() => setSec((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [seen, st.done]);

  const set = (patch, animate) => { setSt((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) })); if (animate) setSwap((n) => n + 1); };
  const pick = (k) => set((p) => { const ans = [...p.ans], conf = [...p.conf]; ans[p.i] = ans[p.i] === k ? null : k; if (ans[p.i] == null) conf[p.i] = null; return { ans, conf }; });
  const strike = (k) => set((p) => { const strike = p.strike.map((a) => [...a]); const a = strike[p.i]; a.includes(k) ? a.splice(a.indexOf(k), 1) : a.push(k); return { strike }; });
  const conf = (c) => set((p) => { const cf = [...p.conf]; cf[p.i] = cf[p.i] === c ? null : c; return { conf: cf }; });
  const next = () => (st.i === Q.length - 1 ? set({ done: true }, true) : set((p) => ({ i: p.i + 1 }), true));
  const retry = () => { setSt(blank()); setSec(0); setRingOff(100); setSwap((n) => n + 1); };

  const right = Q.map((q, i) => st.ans[i] === q.c);
  const correct = right.filter(Boolean).length;
  const wrong = Q.filter((_, i) => st.ans[i] != null && !right[i]).length;
  const marks = correct * 4 - wrong, max = Q.length * 4;
  useEffect(() => { if (st.done) { const t = setTimeout(() => setRingOff(100 - (Math.max(0, marks) / max) * 100), 80); return () => clearTimeout(t); } }, [st.done, marks, max]);

  const q = Q[st.i], a = st.ans[st.i], last = st.i === Q.length - 1;
  const sureWrong = Q.filter((_, i) => st.conf[i] === 'Sure' && st.ans[i] != null && !right[i]).length;
  const sure = st.conf.filter((c) => c === 'Sure').length;
  const msg = sureWrong ? `You were sure about ${sureWrong} answer${sureWrong > 1 ? 's' : ''} that turned out wrong — those cost the most marks.`
    : sure ? 'Your confidence matched your answers. That is exactly what you want on exam day.'
    : correct === Q.length ? 'Clean sweep.' : 'Tag how sure you feel on each answer and Codon shows how reliable your confidence is.';

  return (
    <div className="quiz" ref={ref} data-reveal style={{ '--d': 2 }}>
      <div className="quiz__bar">
        <div className="quiz__pal" aria-label="Question palette">
          {Q.map((_, i) => (
            <button key={i} type="button" className={`${st.ans[i] != null ? 'is-ans' : ''} ${i === st.i && !st.done ? 'is-cur' : ''}`} aria-label={`Question ${i + 1}${st.ans[i] != null ? ', answered' : ''}`} onClick={() => !st.done && set({ i }, true)}>{i + 1}</button>
          ))}
        </div>
        <span className="quiz__clock"><Ico n="clock" /><span>{fmt(sec)}</span></span>
      </div>

      <div className={`quiz__stage${swap && !reduceMotion() ? ' is-swap' : ''}`} key={`${st.done}-${swap}`}>
        {!st.done ? (
          <>
            <p className="qcount">Question {st.i + 1} of {Q.length} · <b>{q.subject}</b></p>
            <h3 className="qtext">{q.q}</h3>
            <div className="qopts" role="group" aria-label="Options">
              {q.o.map((o, k) => {
                const struck = st.strike[st.i].includes(k);
                return (
                  <div key={k} className={`qopt${a === k ? ' is-picked' : ''}${struck ? ' is-struck' : ''}`}>
                    <button type="button" className="qopt__main" aria-pressed={a === k} onClick={() => pick(k)}><i>{'ABCD'[k]}</i><span>{o}</span></button>
                    <button type="button" className="qopt__x" aria-pressed={struck} aria-label={`Cross out option ${'ABCD'[k]}`} title="Cross out" onClick={() => strike(k)}><Ico n="strike" /></button>
                  </div>
                );
              })}
            </div>
            <div className="qconf">
              {a != null ? (
                <>How sure are you? {['Sure', 'Unsure', 'Guess'].map((c) => <button key={c} type="button" className="chip" aria-pressed={st.conf[st.i] === c} onClick={() => conf(c)}>{c}</button>)}</>
              ) : (
                <span className="quiz__hint">Tap an option to answer · tap again to clear · use the line icon to cross one out</span>
              )}
            </div>
            <div className="quiz__nav">
              <button type="button" className="btn btn--ghost btn--sm" style={{ visibility: st.i === 0 ? 'hidden' : 'visible' }} onClick={() => set((p) => ({ i: p.i - 1 }), true)}><span className="btn__label">Back</span></button>
              <button type="button" className="btn btn--primary btn--sm" onClick={next}><span className="btn__label">{last ? 'Submit test' : 'Next'}</span><Arrow /></button>
            </div>
          </>
        ) : (
          <div className="qres">
            <div className="qres__top">
              <div className="ring" style={{ '--off': ringOff }}>
                <svg viewBox="0 0 40 40"><circle className="track" cx="20" cy="20" r="15.915" pathLength="100" /><circle className="bar" cx="20" cy="20" r="15.915" pathLength="100" /></svg>
                <div className="ring__n">{marks}<small>of {max}</small></div>
              </div>
              <ul className="stats">
                <li><b className="ok">{correct}</b>correct (+4 each)</li>
                <li><b className="no">{wrong}</b>wrong (−1 each)</li>
                <li><b>{Q.length - correct - wrong}</b>skipped</li>
                <li><b>{fmt(Math.round(sec / Q.length))}</b>average per question</li>
              </ul>
            </div>
            <p className="qres__msg">{msg}</p>
            <ul className="qexp">
              {Q.map((x, i) => (
                <li key={i}><span className={right[i] ? 'ok' : 'no'}>{right[i] ? '✓' : st.ans[i] == null ? '–' : '✕'}</span><span><b>{x.o[x.c]}.</b> {x.e}</span></li>
              ))}
            </ul>
            <div className="btn-row">
              <button className="btn btn--ghost btn--sm" type="button" onClick={retry}><span className="btn__label">Try again</span></button>
              <a className="btn btn--primary btn--sm" href={site.playStore} target="_blank" rel="noopener"><span className="btn__label">Get the full app</span></a>
            </div>
            <p className="quiz__hint">Three sample questions, scored like NEET: +4 correct, −1 wrong.</p>
          </div>
        )}
      </div>
    </div>
  );
}
