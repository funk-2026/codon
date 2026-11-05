import { Link } from '../lib/router';
import { useMeta } from '../lib/hooks';
import { s } from '../lib/utils';
import { site } from '../data/site';
import { Arrow, Ico } from '../components/Art';
import { StoreButtons } from '../components/Layout';
import { PdfUnlock, ReviewTimer, Stopwatch } from '../components/Widgets';
import { Journey } from './Home';

const FEATURES = [
  ['doc', 'Q Bank, Test Series, Practice', 'By subject, then chapter. Newest or top-rated first.', 'w2'],
  ['chart', 'Custom tests', 'NEET marking. Exam or Tutor mode.'],
  ['grid', 'Result analysis', 'Time, confidence and chapter breakdown.'],
  ['check', 'Review', 'Explanations, notes and how others did.'],
  ['cards', 'Flashcards', 'Spaced repetition: Again to Easy.'],
  ['play', 'Video lectures', 'Speed, quality and notes pinned to the second.', 'w2'],
  ['doc', 'Lecture PDFs', 'Notes now. Annotated notes after 90%.'],
  ['mind', 'Brain Hacks', 'Short, practical tips from the doctors.'],
  ['bookmark', 'Bookmarks', 'Revise later, Doubts, Important.'],
  ['flame', 'Streaks & goals', 'Set 10, 20, 30 or 50 questions a day.'],
  ['chart', 'Chapter heat-map', 'Red, amber, green: know where to go next.'],
  ['heart', 'Support articles', 'Guidance, motivation and reflection prompts.'],
];

const REVIEW = [['doc', 'Draft', 'A teacher writes and tags it'], ['steth', 'In review', 'An admin checks it'], ['check', 'Approved', 'The teacher publishes it'], ['heart', 'Live', 'You can report any problem']];

export default function Marketing() {
  useMeta('The Codon app — tests, flashcards, lectures & analysis for NEET UG', "Everything inside the Codon NEET UG app: Q Bank, Test Series, custom tests, review, flashcards, video lectures with PDFs, mastery heat-map and more. See what's new in October 2026.");
  return (
    <>
      <section className="phead">
        <div className="gridlines" aria-hidden="true" />
        <div className="wrap" style={s('position:relative')}>
          <span className="eyebrow" data-reveal><b>—</b>The app</span>
          <h1 className="h-1" data-lines style={s('max-width:12em')}>
            <span className="line"><span>Your whole NEET UG</span></span>
            <span className="line"><span>loop, in <em>one app.</em></span></span>
          </h1>
          <p className="lead" data-reveal style={s('--d:3')}>Practise, review, revise. Everything below is in the Codon app today.</p>
          <div className="btn-row" data-reveal style={s('--d:4;margin-top:2rem')}><StoreButtons /></div>
        </div>
      </section>

      <section className="section--tight">
        <div className="wrap">
          <div className="fgrid">
            {FEATURES.map(([icon, title, text, w = '']) => (
              <article key={title} className={`fcard ${w}`} data-reveal><Ico n={icon} /><div><h3>{title}</h3><p>{text}</p></div></article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="shead">
            <p className="eyebrow" data-reveal><b>—</b>What's new · October 2026</p>
            <h2 className="h-2" data-reveal style={s('max-width:12em')}>Small details, <em>big</em> difference.</h2>
          </div>
          <div className="widgets">
            <article className="widget" data-reveal>
              <div className="widget__viz"><Stopwatch /></div>
              <div><h3>Q Bank stopwatch</h3><p>Untimed tests now count up so you can pace yourself. It never ends your test, and it feeds your time analysis.</p></div>
            </article>
            <article className="widget" data-reveal style={s('--d:1')}>
              <ReviewTimer />
              <div><h3>2 minutes per question in Review</h3><p>It turns amber for the last 30 seconds, then moves on. Tap it to switch it off. <span className="sm" style={s('color:var(--mute)')}>Demo shown at 10× speed.</span></p></div>
            </article>
            <article className="widget" data-reveal>
              <PdfUnlock />
              <div><h3>Lecture PDFs</h3><p>Notes are there straight away. Annotated notes unlock once you've watched past 90%, and stay unlocked.</p></div>
            </article>
            <article className="widget" data-reveal style={s('--d:1')}>
              <div className="widget__viz">
                <div className="watchviz">
                  <div className="row" style={s('border:0;padding:0')}><span><Ico n="play" />Home → Continue</span><span className="state">After ~30 s</span></div>
                  <div className="pbar plain"><i style={s('width:34%')} /></div>
                </div>
              </div>
              <div><h3>Better watch progress</h3><p>Watch for about 30 seconds and the lecture shows up under Continue. Pausing halfway still counts towards your streak.</p></div>
            </article>
          </div>
          <p className="muted" data-reveal style={s('margin-top:1.4rem;font-size:.85rem;max-width:44em')}>All of these follow dark mode, and screen readers (TalkBack, VoiceOver) read the timers aloud.</p>
        </div>
      </section>

      <section className="section dark">
        <div className="wrap">
          <div className="shead">
            <p className="eyebrow" data-reveal><b>—</b>Built for focus</p>
            <h2 className="h-2" data-reveal style={s('max-width:13em')}>Like the exam. <em>Minus</em> the surprises.</h2>
          </div>
          <div className="focus3" data-stagger>
            <div><Ico n="clock" /><h3>A real deadline</h3><p>Timed tests count down to the real deadline and submit at zero, even if you leave the app.</p></div>
            <div><Ico n="lock" /><h3>Fair by design</h3><p>Screenshots are blocked during tests. A test open on another phone asks where to continue.</p></div>
            <div><Ico n="check" /><h3>No lost answers</h3><p>Offline? Keep answering. They upload when you're back, even if the app was closed.</p></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="shead">
            <p className="eyebrow" data-reveal><b>—</b>Quality</p>
            <h2 className="h-2" data-reveal style={s('max-width:12em')}>Reviewed <em>before</em> it reaches you.</h2>
          </div>
          <Journey steps={REVIEW} />
        </div>
      </section>

      <section className="section--tight">
        <div className="wrap">
          <div className="tilecard is-ink" data-reveal style={s('min-height:0;padding:clamp(1.6rem,4vw,3.5rem);flex-direction:row;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:2rem')}>
            <div style={s('max-width:34em')}>
              <span className="k">Plans &amp; payments</span>
              <h3 className="h-2" style={s('margin:1rem 0 .8rem')}>Start free. Upgrade when you're ready.</h3>
              <p style={s('font-size:1.02rem')}>Plans are shown in the app under Profile → Subscription plans and paid securely through Razorpay. See the <Link className="tlink" to="/refund-policy">refund policy</Link>.</p>
            </div>
            <Link className="btn btn--light" data-magnetic to="/faqs/pay"><span className="btn__label">Payment FAQs</span><Arrow /></Link>
          </div>
        </div>
      </section>

      <section className="section cta">
        <div className="wrap">
          <h2 className="h-1" data-reveal>Ready when <em>you</em> are.</h2>
          <div className="btn-row" data-reveal style={s('--d:2')}>
            <StoreButtons />
            <a className="btn btn--ghost" data-magnetic href={site.whatsapp} target="_blank" rel="noopener"><span className="btn__label">Questions? WhatsApp us</span><Arrow /></a>
          </div>
        </div>
      </section>
    </>
  );
}
