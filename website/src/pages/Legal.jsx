import { useEffect, useState } from 'react';
import { Link, ScrollLink } from '../lib/router';
import { useMeta } from '../lib/hooks';
import { s } from '../lib/utils';
import { site } from '../data/site';
import { legal } from '../data/legal';

// One template for Privacy policy, Terms and Refund policy: sticky contents list + numbered sections.
function LegalPage({ doc }) {
  useMeta(`${doc.title} — Codon`, doc.description);
  const [active, setActive] = useState(doc.sections[0].id);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-20% 0px -70% 0px' });
    doc.sections.forEach((x) => { const el = document.getElementById(x.id); el && io.observe(el); });
    return () => io.disconnect();
  }, [doc]);

  return (
    <>
      <section className="phead">
        <div className="gridlines" aria-hidden="true" />
        <div className="wrap" style={s('position:relative')}>
          <span className="eyebrow" data-reveal><b>—</b>{doc.eyebrow}</span>
          <h1 className="h-1" data-lines style={s('max-width:12em')} dangerouslySetInnerHTML={{ __html: doc.titleHtml }} />
          <p className="lead" data-reveal style={s('--d:3')}>{doc.lead}</p>
          <p className="phead__meta" data-reveal style={s('--d:4')}><span>Last updated: {doc.updated}</span><span>{site.legalName}</span><Link className="tlink" to="/contact">Questions? Contact us</Link></p>
        </div>
      </section>

      <section className="section--tight" style={s('padding-bottom:clamp(5rem,10vw,10rem)')}>
        <div className="wrap legal">
          <aside className="toc" aria-label="On this page">
            <span className="eyebrow">On this page</span>
            <ol>{doc.sections.map((x) => <li key={x.id}><ScrollLink to={x.id} className={active === x.id ? 'on' : ''}>{x.title}</ScrollLink></li>)}</ol>
          </aside>
          <div className="legal-body">
            {doc.sections.map((x) => (
              <section id={x.id} key={x.id}><h2>{x.title}</h2><div dangerouslySetInnerHTML={{ __html: x.html }} /></section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export const Privacy = () => <LegalPage doc={legal['privacy-policy']} />;
export const Terms = () => <LegalPage doc={legal.terms} />;
export const Refund = () => <LegalPage doc={legal['refund-policy']} />;
