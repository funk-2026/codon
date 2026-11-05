import { useEffect, useRef, useState } from 'react';
import { Ico } from './Art';
import { MasteryTiles, Ring } from './Bits';
import { useInView } from '../lib/hooks';
import { reduceMotion, s } from '../lib/utils';

const TABS = [
  { n: 'grid', label: 'Home', text: 'Daily goal, streak, and every tool one tap away.' },
  { n: 'doc', label: 'Practice', text: 'Q Bank, Test Series and custom tests by subject and chapter.' },
  { n: 'play', label: 'Learn', text: 'Video lectures with notes, PDFs and spaced-repetition flashcards.' },
  { n: 'chart', label: 'Progress', text: 'A heat-map of every chapter, so you know where to go next.' },
  { n: 'mind', label: 'Support', text: 'Guidance and motivation articles for the long haul.' },
];

const Nav5 = ({ on }) => (
  <div className="nav5">
    {[['Home', 'grid'], ['Practice', 'doc'], ['Learn', 'play'], ['Support', 'mind'], ['Profile', 'chart']].map(([l, i]) => (
      <span key={l} className={l === on ? 'on' : ''}><Ico n={i} />{l}</span>
    ))}
  </div>
);

const Screens = [
  () => (
    <>
      <div className="row"><div><span className="sm">Hello</span><h4>Today</h4></div><span className="pillx on"><Ico n="flame" />12 day streak</span></div>
      <div className="card row"><div><span className="sm">Daily goal</span><h4 style={s('font-size:5.4cqi;margin-top:1cqi')}>14 of 20</h4><span className="sm">questions today</span></div><Ring off={30} n="14" small="of 20" /></div>
      <div className="tiles2">{[['grid', 'Q Bank'], ['doc', 'Test Series'], ['chart', 'Custom Test'], ['cards', 'Flashcards'], ['play', 'Video Classes'], ['mind', 'Support']].map(([i, l]) => <div key={l}><Ico n={i} />{l}</div>)}</div>
      <Nav5 on="Home" />
    </>
  ),
  () => (
    <>
      <h4>Biology</h4>
      <div className="row" style={s('justify-content:flex-start')}><span className="pillx on">Q Bank</span><span className="pillx">Test Series</span><span className="pillx">Practice</span></div>
      <div className="row"><span className="sm">Chapters</span><span className="pillx">Newest · Top rated</span></div>
      <div className="card list">
        <div>Cell: The Unit of Life<span className="sm">★ 4.6</span></div>
        <div>Biomolecules<span className="sm">★ 4.4</span></div>
        <div>Cell Cycle and Cell Division<Ico n="lock" /></div>
        <div>Photosynthesis in Higher Plants<Ico n="lock" /></div>
      </div>
      <div className="card row"><div><span className="sm">Continue</span><div style={s('font-weight:600')}>Biomolecules · 14 of 30</div></div><Ico n="play" /></div>
      <Nav5 on="Practice" />
    </>
  ),
  () => (
    <>
      <h4>Learn</h4>
      <div className="vid"><em>LECTURE</em><Ico n="play" /><i /></div>
      <div className="row"><span className="pillx on">+ Note at 12:40</span><span className="sm">1.5× · HD</span></div>
      <div className="card list"><div>Notes<span className="pillx on">Download</span></div><div>Annotated notes<span className="pillx"><Ico n="lock" />After 90%</span></div></div>
      <div className="card row"><div><span className="sm">Flashcards · Quick mode</span><div style={s('font-weight:600')}>10 cards due</div></div><Ico n="cards" /></div>
      <Nav5 on="Learn" />
    </>
  ),
  () => (
    <>
      <h4>Your progress</h4>
      <div className="card"><div className="row" style={s('margin-bottom:2.4cqi')}><span className="sm">Mastery heat-map</span><span className="sm">Chapters</span></div><div className="tiles"><MasteryTiles /></div></div>
      <div className="card"><div className="row" style={s('margin-bottom:2.4cqi')}><span className="sm">Last 7 days</span><span className="pillx on"><Ico n="flame" />12</span></div><div className="week">{[1, 1, 1, 0, 1, 1, 1].map((o, i) => <i key={i} className={o ? 'on' : ''} />)}</div></div>
      <div className="card row"><div><span className="sm">Weak area</span><div style={s('font-weight:600')}>Human Reproduction</div></div><span className="pillx on">Practise</span></div>
      <Nav5 on="Profile" />
    </>
  ),
  () => (
    <>
      <h4>Support</h4>
      <div className="row" style={s('justify-content:flex-start;flex-wrap:wrap')}><span className="pillx on">Guidance</span><span className="pillx">Motivation</span><span className="pillx">Reflection</span></div>
      <div className="card"><span className="pillx on" style={s('margin-bottom:2.4cqi')}>Today</span><div className="skel"><i /><i /><i /></div></div>
      <div className="card"><div className="skel"><i /><i /></div></div>
      <div className="card"><div className="skel"><i /><i /></div></div>
      <Nav5 on="Support" />
    </>
  ),
];

// Tabs on the left drive a phone mock-up on the right. Auto-advances until the visitor interacts.
export default function Explorer() {
  const [idx, setIdx] = useState(0);
  const [ref, seen] = useInView(0.5);
  const auto = useRef(true);
  const tabRefs = useRef([]);

  useEffect(() => {
    if (!seen || reduceMotion()) return;
    const t = setInterval(() => { if (auto.current) setIdx((i) => (i + 1) % TABS.length); }, 4200);
    return () => clearInterval(t);
  }, [seen]);

  const go = (i, focus) => { auto.current = false; setIdx(i); if (focus) tabRefs.current[i]?.focus(); };
  const onKey = (e) => {
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); go((idx + 1) % TABS.length, true); }
    if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); go((idx - 1 + TABS.length) % TABS.length, true); }
  };

  return (
    <div className="wrap explore" ref={ref} onPointerEnter={() => (auto.current = false)}>
      <div>
        <p className="eyebrow" data-reveal><b>03</b>Inside the app</p>
        <h2 className="h-1" data-reveal style={s('margin:1.2rem 0 0')}>One app. <em>Everything</em> in reach.</h2>
        <div className="tabs" role="tablist" aria-label="App sections" data-reveal style={s('--d:2')} onKeyDown={onKey}>
          {TABS.map((t, i) => (
            <button key={t.label} ref={(el) => (tabRefs.current[i] = el)} role="tab" type="button" aria-selected={idx === i} tabIndex={idx === i ? 0 : -1} onClick={() => go(i)}>
              <Ico n={t.n} /><b>{t.label}</b><span>{t.text}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="phone-wrap" data-reveal="fade" style={s('--d:2')}>
        <div className="phone">
          <div className="screen">
            {Screens.map((Scr, i) => (
              <div key={i} className={`scr${idx === i ? ' is-on' : ''}`} role="tabpanel" aria-label={TABS[i].label} aria-hidden={idx !== i}><Scr /></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
