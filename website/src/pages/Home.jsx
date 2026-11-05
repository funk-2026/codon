import { Link, ScrollLink } from '../lib/router';
import { useMeta } from '../lib/hooks';
import { s } from '../lib/utils';
import { site, faculty, marquee } from '../data/site';
import { Arrow, Ecg, Helix, Ico } from '../components/Art';
import { Counter, MasteryTiles, Ring } from '../components/Bits';
import { StoreButtons } from '../components/Layout';
import Quiz from '../components/Quiz';
import PulseChart from '../components/PulseChart';
import Explorer from '../components/Explorer';
import Builder from '../components/Builder';
import Decoder from '../components/Decoder';

export const Doc = ({ m }) => (
  <article className="doc" data-reveal>
    <div className="doc__av">{m.img ? <img src={m.img} alt={m.name} loading="lazy" width="160" height="160" /> : <span>{m.name.replace(/^Dr\.?\s*/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('')}</span>}</div>
    <h3>{m.name}</h3>
    <p className="doc__role">{m.role}</p>
    <p className="doc__bio">{m.bio}</p>
  </article>
);

export const Journey = ({ steps }) => (
  <ol className="journey" data-inview>
    {steps.map(([icon, title, sub]) => <li key={title}><Ico n={icon} />{title}<small>{sub}</small></li>)}
  </ol>
);

export const PATH = [['cross', 'NEET UG', "The exam you're preparing for"], ['steth', 'MBBS', 'Medical school'], ['chart', 'NEET PG', 'Postgraduate entrance'], ['heart', 'Residency', 'Training in the hospital']];

const Marquee = () => {
  const row = marquee.map((i) => <span key={i}>{i}</span>);
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track"><div style={s('display:flex')}>{row}</div><div style={s('display:flex')}>{row}</div></div>
    </div>
  );
};

export default function Home() {
  useMeta('Codon — NEET UG practice, built by doctors', 'Codon is a NEET UG practice app by surgeons and physicians: timed tests, custom tests, honest result analysis, flashcards, video lectures and mentorship.');
  return (
    <>
      <section className="hero">
        <div className="gridlines" aria-hidden="true" />
        <div className="hero__helix" aria-hidden="true"><Helix w={140} periods={3} lam={240} /></div>
        <div className="wrap hero__grid">
          <div className="hero__copy">
            <p className="eyebrow" data-reveal><span className="pill"><i className="dot" />Built by surgeons &amp; physicians</span></p>
            <h1 className="h-hero" data-lines>
              <span className="line"><span>NEET UG,</span></span>
              <span className="line"><span>practised</span></span>
              <span className="line"><span><em>properly.</em></span></span>
            </h1>
            <p className="lead" data-reveal style={s('--d:4')}>Tests that feel like the exam. Results that explain themselves. Mentors who've been there.</p>
            <div className="btn-row" data-reveal style={s('--d:5')}>
              <StoreButtons />
              <ScrollLink className="btn btn--ghost" data-magnetic to="try"><span className="btn__label">Try a question</span><Arrow /></ScrollLink>
            </div>
          </div>

          <div className="hero__visual" data-reveal="fade" style={s('--d:3')}>
            <div className="hv" role="img" aria-label="Illustration of the Codon app: a practice question, daily goal ring, day streak and chapter mastery.">
              <div className="ui q" data-parallax="0.35">
                <div className="ui__title"><span>Question 12 of 30</span><span className="timer"><Ico n="clock" />42:18</span></div>
                <p className="q__text">Which organelle is the powerhouse of the cell?</p>
                <div className="opt is-struck"><i>A</i>Nucleus</div>
                <div className="opt is-picked"><i>B</i>Mitochondria</div>
                <div className="opt"><i>C</i>Ribosome</div>
                <div className="opt"><i>D</i>Golgi apparatus</div>
                <div className="sure">How sure are you? <b className="on">Sure</b><b>Unsure</b><b>Guess</b></div>
              </div>
              <div className="ui goal" data-parallax="0.7"><div className="ui__title">Daily goal</div><Ring off={30} n="14" small="of 20" /></div>
              <div className="ui streak" data-parallax="1"><Ico n="flame" /><b>12</b><span>day<br />streak</span></div>
              <div className="ui heat" data-parallax="0.55"><div className="ui__title">Chapter mastery</div><div className="tiles"><MasteryTiles count={28} step={3} /></div></div>
            </div>
            <p className="illus">Illustrative screens</p>
          </div>
        </div>
        <div className="hero__ecg" aria-hidden="true"><Ecg /></div>
      </section>

      <Marquee />

      <section className="section" id="try">
        <div className="wrap tryit">
          <div>
            <p className="eyebrow" data-reveal><b>01</b>Try it</p>
            <h2 className="h-1" data-reveal style={s('margin:1.2rem 0')}>Feel the test <em>before</em> you install.</h2>
            <p className="lead" data-reveal style={s('--d:2')}>Cross out options, tag how sure you are, and get a result the way the app gives it.</p>
          </div>
          <Quiz />
        </div>
      </section>

      <section className="section" style={s('padding-top:0')}>
        <div className="wrap">
          <div className="shead">
            <p className="eyebrow" data-reveal><b>02</b>Your progress</p>
            <h2 className="h-1" data-reveal style={s('max-width:12em')}>See your preparation's <em>pulse.</em></h2>
          </div>
          <PulseChart />
        </div>
      </section>

      <section className="section" style={s('padding-top:0')}>
        <Explorer />
        <p className="illus" style={s('margin-top:1rem')}>Illustrative screens · sample content</p>
      </section>

      <section className="section dark" id="builder">
        <div className="wrap builder">
          <div>
            <p className="eyebrow" data-reveal><b>04</b>Custom tests</p>
            <h2 className="h-1" data-reveal style={s('margin:1.4rem 0')}>Build the exact test <em>you</em> need.</h2>
            <p className="lead" data-reveal style={s('--d:2')}>Subjects, difficulty, Exam or Tutor mode, NEET marking or your own. Save it, or share it with a code.</p>
            <p className="muted" data-reveal style={s('--d:3;margin-top:1.2rem;font-size:.85rem')}>Interactive demo. In the app, custom tests appear once switched on for your course.</p>
          </div>
          <Builder />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="shead">
            <p className="eyebrow" data-reveal><b>05</b>The doctors</p>
            <h2 className="h-1" data-reveal style={s('max-width:13em')}>Taught by doctors who've <em>walked the path.</em></h2>
          </div>
          <Journey steps={PATH} />
          <div className="docs" style={s('margin-top:clamp(2rem,5vw,4rem)')}>
            {faculty.map((m) => <Doc key={m.name} m={m} />)}
            <article className="mmmcard" data-reveal>
              <Ico n="mind" />
              <b><Counter end={40} suffix="+" /></b>
              <p><strong style={s('color:var(--paper)')}>Doctors in Mind Mentor Mitra</strong><br />supporting students' mental well-being, whichever coaching platform they use.</p>
            </article>
          </div>
          <div className="btn-row" style={s('margin-top:2rem')} data-reveal><Link className="btn btn--ghost" data-magnetic to="/about"><span className="btn__label">Our story</span><Arrow /></Link></div>
        </div>
      </section>

      <section className="section dark">
        <div className="wrap decode">
          <div>
            <p className="eyebrow" data-reveal><b>06</b>Why “Codon”?</p>
            <h2 className="h-1" data-reveal style={s('margin:1.2rem 0')}>Three letters at a time.</h2>
            <p className="lead" data-reveal style={s('--d:2')}>A codon is three letters of the genetic code, and each one tells a cell which amino acid comes next. Small units, built in order, become something that works. That is how we build your preparation, chapter by chapter.</p>
          </div>
          <Decoder />
        </div>
      </section>

      <section className="section cta">
        <div className="wrap">
          <h2 className="h-1" data-reveal>Learn on <em>the go.</em></h2>
          <p className="lead" data-reveal style={s('--d:2')}>Sign in with your phone number, pick your course, and start practising.</p>
          <div className="btn-row" data-reveal style={s('--d:3')}><StoreButtons /></div>
        </div>
      </section>
    </>
  );
}
