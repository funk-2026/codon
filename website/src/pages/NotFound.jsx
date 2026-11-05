import { Link } from '../lib/router';
import { useMeta } from '../lib/hooks';
import { s } from '../lib/utils';
import { Arrow } from '../components/Art';

export default function NotFound() {
  useMeta('Page not found — Codon', 'This page could not be found.');
  return (
    <section className="nf wrap">
      <span className="eyebrow">Error 404</span>
      <h1 className="h-hero">Wrong <em>chapter.</em></h1>
      <p className="lead" style={s('margin-inline:auto')}>That page doesn't exist, or it moved. Let's get you back to something useful.</p>
      <div className="btn-row" style={s('justify-content:center')}>
        <Link className="btn btn--primary" data-magnetic to="/"><span className="btn__label">Back home</span><Arrow /></Link>
        <Link className="btn btn--ghost" data-magnetic to="/faqs"><span className="btn__label">Browse FAQs</span><Arrow /></Link>
      </div>
    </section>
  );
}
