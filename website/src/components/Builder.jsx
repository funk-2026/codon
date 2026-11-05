import { useState } from 'react';

const MARKING = { neet: 'NEET +4 / −1', none: 'No negative marking', custom: 'Custom marking' };

// Custom-test builder demo (the real one lives in the app).
export default function Builder() {
  const [subj, setSubj] = useState(['Biology']);
  const [diff, setDiff] = useState('Mixed');
  const [mode, setMode] = useState('Exam');
  const [mark, setMark] = useState('neet');
  const [count, setCount] = useState(45);

  const toggle = (v) => setSubj((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const Chip = ({ on, onClick, children }) => <button className="chip" type="button" aria-pressed={on} onClick={onClick}>{children}</button>;

  return (
    <div className="bcard" data-reveal style={{ '--d': 2 }}>
      <div><h3>Subjects</h3><div className="chips">{['Biology', 'Chemistry', 'Physics'].map((v) => <Chip key={v} on={subj.includes(v)} onClick={() => toggle(v)}>{v}</Chip>)}</div></div>
      <div><h3>Difficulty</h3><div className="chips">{['Mixed', 'Easy', 'Medium', 'Hard'].map((v) => <Chip key={v} on={diff === v} onClick={() => setDiff(v)}>{v}</Chip>)}</div></div>
      <div>
        <h3>Mode &amp; marking</h3>
        <div className="chips">{['Exam', 'Tutor'].map((v) => <Chip key={v} on={mode === v} onClick={() => setMode(v)}>{v}</Chip>)}</div>
        <div className="chips" style={{ marginTop: '.5rem' }}>{Object.entries(MARKING).map(([k, label]) => <Chip key={k} on={mark === k} onClick={() => setMark(k)}>{k === 'custom' ? 'Custom' : k === 'none' ? 'No negative' : label}</Chip>)}</div>
      </div>
      <div><h3><span>Questions</span></h3><input className="range" type="range" min="10" max="90" step="5" value={count} onChange={(e) => setCount(+e.target.value)} aria-label="Number of questions" /></div>
      <div className="bsum">
        <div><big>{count} questions</big><span>{count} min · {count * 4} marks · {MARKING[mark]}</span></div>
        <p className="go">{subj.join(', ') || 'All subjects'} · {diff} · {mode} mode</p>
      </div>
    </div>
  );
}
