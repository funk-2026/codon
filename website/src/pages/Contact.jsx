import { Link } from '../lib/router';
import { useMeta } from '../lib/hooks';
import { s } from '../lib/utils';
import { site } from '../data/site';
import { Arrow } from '../components/Art';

export default function Contact() {
  useMeta('Contact us — Codon', `Reach Codon on WhatsApp (${site.phoneDisplay}) or email (${site.email}), ${site.hours}. Support for accounts, payments, mentorship and reporting questions.`);
  return (
    <>
      <section className="phead">
        <div className="gridlines" aria-hidden="true" />
        <div className="wrap" style={s('position:relative')}>
          <span className="eyebrow" data-reveal><b>—</b>Contact us</span>
          <h1 className="h-1" data-lines style={s('max-width:11em')}>
            <span className="line"><span>Say hello.</span></span>
            <span className="line"><span><em>Ask anything.</em></span></span>
          </h1>
          <p className="lead" data-reveal style={s('--d:3')}>Questions about the app, your account, a payment or mentorship? Reach us on WhatsApp or email, {site.hours}.</p>
        </div>
      </section>

      <section className="section--tight">
        <div className="wrap contact-grid" data-stagger>
          <a className="ccard is-ink" href={site.whatsapp} target="_blank" rel="noopener">
            <Arrow />
            <span className="k">WhatsApp &amp; calls · {site.hours}</span>
            <div><span className="v">{site.phoneDisplay}</span><p>Message or call. Chat is the quickest way to reach us.</p></div>
          </a>
          <a className="ccard" href={`mailto:${site.email}`}>
            <Arrow />
            <span className="k">Email</span>
            <div><span className="v">{site.email}</span><p>For payments, refunds, privacy requests and anything you'd like in writing.</p></div>
          </a>
          <a className="ccard w12" href={site.mapsUrl} target="_blank" rel="noopener" style={s('min-height:0;gap:1rem')}>
            <Arrow />
            <span className="k">Registered office</span>
            <div><span className="v" style={s('font-size:clamp(1.5rem,1rem + 1.6vw,2.6rem)')}>{site.legalName}</span><p>{site.address.join(' ')}</p></div>
          </a>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div data-reveal>
            <span className="eyebrow"><b>—</b>Not sure where to start?</span>
            <h2 className="h-2" style={s('margin-top:1rem')}>The quickest route <em>for each need.</em></h2>
          </div>
          <ul className="topics" data-stagger>
            <li><b>Sign-in or account</b><span>Check the number you entered, then see <Link className="tlink" to="/faqs/signin">sign-in help</Link>. Still stuck? WhatsApp us the phone number you registered with.</span></li>
            <li><b>A wrong question or typo</b><span>Open the question in the app and tap <em>Report a problem</em>. Track it under Profile → My reports — you'll be notified when it's fixed.</span></li>
            <li><b>Payments &amp; refunds</b><span>Read the <Link className="tlink" to="/refund-policy">refund policy</Link>, then email us the payment details from your Razorpay receipt.</span></li>
            <li><b>Mentorship &amp; MMM</b><span>Message us on WhatsApp — everything shared with MMM is treated as confidential.</span></li>
            <li><b>Privacy requests</b><span>Email us from the address or number linked to your account. See the <Link className="tlink" to="/privacy-policy">privacy policy</Link>.</span></li>
          </ul>
        </div>
      </section>

      <section className="section--tight" style={s('padding-bottom:clamp(5rem,10vw,10rem)')}>
        <div className="wrap" style={s('text-align:center')}>
          <p className="eyebrow" data-reveal>Or find your answer instantly</p>
          <Link className="link-xl" data-reveal style={s('--d:1;display:inline-block;margin-top:1rem')} to="/faqs">Browse the FAQs →</Link>
        </div>
      </section>
    </>
  );
}
