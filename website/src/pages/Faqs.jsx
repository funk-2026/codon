import { useEffect, useMemo, useState } from 'react';
import { Link, useRoute } from '../lib/router';
import { useMeta } from '../lib/hooks';
import { s, stripHtml } from '../lib/utils';
import { site } from '../data/site';
import { faqGroups } from '../data/faq';
import { Arrow } from '../components/Art';

const highlight = (text, q) => {
  if (!q || q.length < 3) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  return i < 0 ? text : <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
};

export default function Faqs() {
  useMeta('FAQs — Codon', 'Answers about the Codon NEET UG app: signing in, tests and timers, custom tests, flashcards, lecture PDFs, subscriptions, refunds, privacy and Mind Mentor Mitra.');
  const { sub } = useRoute();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(sub || null);

  useEffect(() => {
    if (!sub) return;
    setOpen(sub);
    const t = setTimeout(() => document.getElementById(sub)?.scrollIntoView({ block: 'center' }), 80);
    return () => clearTimeout(t);
  }, [sub]);

  const needle = q.trim().toLowerCase();
  const groups = useMemo(
    () => faqGroups
      .filter((g) => cat === 'all' || g.id === cat)
      .map((g) => ({ ...g, items: g.items.filter(([, question, answer]) => !needle || `${question} ${stripHtml(answer)}`.toLowerCase().includes(needle)) }))
      .filter((g) => g.items.length),
    [cat, needle],
  );

  return (
    <>
      <section className="phead">
        <div className="gridlines" aria-hidden="true" />
        <div className="wrap" style={s('position:relative')}>
          <span className="eyebrow" data-reveal><b>—</b>FAQs</span>
          <h1 className="h-1" data-lines style={s('max-width:11em')}>
            <span className="line"><span>Answers,</span></span>
            <span className="line"><span><em>without the wait.</em></span></span>
          </h1>
          <p className="lead" data-reveal style={s('--d:3')}>Everything about Codon, from signing in to spaced repetition. Can't find it? <Link className="tlink" to="/contact">Ask us</Link>.</p>
        </div>
      </section>

      <section className="section--tight" style={s('padding-bottom:clamp(4rem,8vw,8rem)')}>
        <div className="wrap" style={s('max-width:62rem')}>
          <div className="faq-tools">
            <label className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <span className="sr">Search the FAQs</span>
              <input type="search" placeholder="Search — e.g. refund, offline, flashcards" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className="chips" role="group" aria-label="Filter by topic">
              <button className="chip" type="button" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All</button>
              {faqGroups.map((g) => <button key={g.id} className="chip" type="button" aria-pressed={cat === g.id} onClick={() => setCat(g.id)}>{g.title}</button>)}
            </div>
          </div>

          {groups.map((g) => (
            <div className="faq-group" key={g.id}>
              <h2 className="h-3"><small>{String(faqGroups.findIndex((x) => x.id === g.id) + 1).padStart(2, '0')}</small>{g.title}</h2>
              {g.items.map(([id, question, answer]) => {
                const isOpen = needle ? true : open === id;
                return (
                  <details className="faq" id={id} key={id} open={isOpen}>
                    <summary onClick={(e) => { e.preventDefault(); setOpen(open === id ? null : id); }}>
                      <span>{highlight(question, needle)}</span><i aria-hidden="true" />
                    </summary>
                    <div className="faq__a" dangerouslySetInnerHTML={{ __html: answer }} />
                  </details>
                );
              })}
            </div>
          ))}
          {!groups.length && <p className="faq-empty">No answers match that search. <Link className="tlink" to="/contact">Ask us directly →</Link></p>}
        </div>
      </section>

      <section className="section--tight dark" style={s('padding-block:clamp(4rem,8vw,7rem)')}>
        <div className="wrap" style={s('display:flex;flex-wrap:wrap;gap:2rem;justify-content:space-between;align-items:center')}>
          <h2 className="h-2" style={s('max-width:11em')}>Still have a <em>question?</em></h2>
          <div className="btn-row">
            <a className="btn btn--light" data-magnetic href={site.whatsapp} target="_blank" rel="noopener"><span className="btn__label">Chat on WhatsApp</span><Arrow /></a>
            <a className="btn btn--ghost" data-magnetic href={`mailto:${site.email}`}><span className="btn__label">Email us</span><Arrow /></a>
          </div>
        </div>
      </section>
    </>
  );
}
