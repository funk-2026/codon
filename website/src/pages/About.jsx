import { Link } from '../lib/router';
import { useMeta } from '../lib/hooks';
import { s } from '../lib/utils';
import { site, faculty } from '../data/site';
import { Arrow, Helix, Ico } from '../components/Art';
import { Counter } from '../components/Bits';
import { StoreButtons } from '../components/Layout';
import { Doc, Journey, PATH } from './Home';

export default function About() {
  useMeta('About us — Codon', 'Codon was built by surgeons and physicians who once sat NEET themselves. Meet Dr. Yogesh Desarda, our mission, and Mind Mentor Mitra, our student well-being initiative.');
  return (
    <>
      <section className="phead">
        <div className="gridlines" aria-hidden="true" />
        <div className="hero__helix" aria-hidden="true"><Helix w={140} periods={3} lam={240} /></div>
        <div className="wrap" style={s('position:relative')}>
          <span className="eyebrow" data-reveal><b>—</b>About us</span>
          <h1 className="h-1" data-lines style={s('max-width:12em')}>
            <span className="line"><span>Every sincere student</span></span>
            <span className="line"><span>can <em>rise beyond</em></span></span>
            <span className="line"><span>their limitations.</span></span>
          </h1>
          <p className="lead" data-reveal style={s('--d:3')}>Codon was born from the belief that, with the right mentorship, that is true.</p>
        </div>
      </section>

      <section className="section--tight">
        <div className="wrap story">
          <div className="story__side" data-reveal>
            <span className="eyebrow">Our story</span>
            <p className="h-3" style={s('margin-top:1rem')}>{site.founder}<br /><span className="muted" style={s('font-size:.6em;font-family:var(--sans);letter-spacing:0')}>General &amp; Laparoscopic Surgeon<br />Founder, Codon</span></p>
          </div>
          <div className="prose" data-stagger>
            <p className="big">“I was once an ordinary middle-class student with an extraordinary dream.”</p>
            <p>During my entrance-exam preparation I faced many challenges, from financial limits to confusion about how and when to study. Like many students, I struggled with self-doubt and a lack of guidance.</p>
            <p>Codon is built by doctors who have walked the same path, based on their own experiences through NEET UG and PG, all the way to residency.</p>
            <p className="big">Codon is not just an app. It is a mission to help average and middle-class students turn potential into success.</p>
          </div>
        </div>
      </section>

      <section className="section--tight">
        <div className="wrap">
          <Journey steps={PATH} />
          <div className="docs" style={s('margin-top:clamp(2rem,5vw,4rem)')}>{faculty.map((m) => <Doc key={m.name} m={m} />)}</div>
        </div>
      </section>

      <section className="section dark">
        <div className="wrap">
          <p className="eyebrow" data-reveal><b>—</b>Mind Mentor Mitra</p>
          <h2 className="h-1" data-reveal style={s('margin:1.2rem 0 clamp(2rem,5vw,4rem);max-width:11em')}>Success isn't only <em>academic.</em></h2>
          <div className="mm">
            <div data-reveal>
              <p className="lead" style={s('color:#d9dde4')}>MMM gives students a safe, confidential space to share concerns and manage stress, anxiety and burnout.</p>
              <p className="lead" style={s('margin-top:1.2rem')}>Open to students from any coaching platform, and to resident doctors who need someone to talk to.</p>
            </div>
            <div data-reveal style={s('--d:2;display:grid;gap:2rem;align-content:start')}>
              <div><span className="num"><Counter end={40} suffix="+" /></span><p className="muted">doctors have joined MMM to support students' mental well-being.</p></div>
              <div><span className="num"><Counter end={4} suffix="+" /></span><p className="muted">years of mentoring by Dr. Akshat Chaturvedi, guiding many into India's top medical colleges.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="vm" data-stagger>
            <div><Ico n="heart" /><h3 className="h-2" style={s('margin:.8rem 0 1rem')}>Our mission</h3><p>To empower below-average, average and aspiring students with the right mentorship, structured guidance and emotional support to clear NEET UG and grow with confidence.</p></div>
            <div><Ico n="steth" /><h3 className="h-2" style={s('margin:.8rem 0 1rem')}>Our vision</h3><p>A supportive learning ecosystem where every student, regardless of background, feels capable and mentally strong.</p></div>
          </div>
        </div>
      </section>

      <section className="section--tight">
        <div className="wrap">
          <hr className="hr" style={s('margin-bottom:clamp(2rem,5vw,4rem)')} />
          <div style={s('display:flex;flex-wrap:wrap;gap:2rem 4rem;justify-content:space-between;align-items:start')}>
            <div className="company" data-reveal>
              <span className="eyebrow">The company</span>
              <h3 style={s('margin-top:.8rem')}>{site.legalName}</h3>
              <address>{site.address.map((l, i) => <span key={l}>{l}{i < site.address.length - 1 && <br />}</span>)}</address>
            </div>
            <div data-reveal style={s('--d:2;max-width:30em')}>
              <h2 className="h-3">Want to talk to us?</h2>
              <p className="muted" style={s('margin:.8rem 0 1.4rem')}>WhatsApp or email us, {site.hours}.</p>
              <div className="btn-row">
                <Link className="btn btn--primary" data-magnetic to="/contact"><span className="btn__label">Contact us</span><Arrow /></Link>
                <Link className="btn btn--ghost" data-magnetic to="/faqs"><span className="btn__label">Read the FAQs</span><Arrow /></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section cta">
        <div className="wrap">
          <h2 className="h-1" data-reveal>Start with <em>one</em> test.</h2>
          <div className="btn-row" data-reveal style={s('--d:2')}><StoreButtons /></div>
        </div>
      </section>
    </>
  );
}
