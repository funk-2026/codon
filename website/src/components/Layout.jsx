import { useEffect, useRef, useState } from 'react';
import { Link, useRoute } from '../lib/router';
import { finePointer, reduceMotion } from '../lib/utils';
import { site, nav, footerCols } from '../data/site';
import { Arrow } from './Art';

export const StoreButtons = ({ variant = 'primary' }) => (
  <>
    <a className={`btn btn--${variant}`} data-magnetic href={site.playStore} target="_blank" rel="noopener">
      <span className="btn__label">Get it on Google Play</span>
      <Arrow />
    </a>
    {site.appStore && (
      <a className="btn btn--ghost" data-magnetic href={site.appStore} target="_blank" rel="noopener">
        <span className="btn__label">Download on the App Store</span>
        <Arrow />
      </a>
    )}
  </>
);

export function Header() {
  const { path } = useRoute();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [onDark, setOnDark] = useState(false);

  useEffect(() => {
    const tick = () => {
      setScrolled(scrollY > 24);
      setOnDark([...document.querySelectorAll('.dark')].some((d) => { const r = d.getBoundingClientRect(); return r.top <= 36 && r.bottom >= 36; }));
    };
    tick();
    addEventListener('scroll', tick, { passive: true });
    addEventListener('resize', tick);
    return () => { removeEventListener('scroll', tick); removeEventListener('resize', tick); };
  }, [path]);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    const wide = matchMedia('(min-width: 62rem)');
    const onWide = (m) => m.matches && setOpen(false);
    addEventListener('keydown', esc);
    wide.addEventListener('change', onWide);
    return () => { removeEventListener('keydown', esc); wide.removeEventListener('change', onWide); };
  }, [open]);

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}${onDark ? ' on-dark' : ''}`}>
      <div className="wrap site-header__bar">
        <Link className="brand" to="/" aria-label={`${site.name} home`}>
          <span className="brand__logo" role="img" aria-label={site.name} />
        </Link>
        <nav className="nav" aria-label="Primary">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} aria-current={path === n.to ? 'page' : undefined}>{n.label}</Link>
          ))}
        </nav>
        <a className="btn btn--primary btn--sm nav__cta" data-magnetic href={site.playStore} target="_blank" rel="noopener">
          <span className="btn__label">Get the app</span>
          <Arrow />
        </a>
        <button className="menu-btn" type="button" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
          <span className="menu-btn__bars" aria-hidden="true" />
          <span className="sr">Menu</span>
        </button>
      </div>
      <div className="mobile-menu" id="mobile-menu" inert={!open}>
        <nav aria-label="Mobile">
          {[{ to: '/', label: 'Home' }, ...nav].map((n, i) => (
            <Link key={n.to} to={n.to} style={{ '--i': i }}>{n.label}</Link>
          ))}
        </nav>
        <p className="mobile-menu__meta">{site.email}<br />{site.phoneDisplay}</p>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="site-footer__top">
          <div className="site-footer__lead">
            <p className="site-footer__cta">Questions before you start?</p>
            <a className="link-xl" href={`mailto:${site.email}`}>{site.email}</a>
            <p className="muted">
              WhatsApp &amp; calls · {site.hours}<br />
              <a href={site.whatsapp} target="_blank" rel="noopener">{site.phoneDisplay}</a>
            </p>
          </div>
          <div className="site-footer__cols">
            {footerCols.map((c) => (
              <div key={c.title}>
                <h2 className="eyebrow">{c.title}</h2>
                <ul>{c.links.map((l) => <li key={l.to}><Link to={l.to}>{l.label}</Link></li>)}</ul>
              </div>
            ))}
          </div>
        </div>
        <div className="site-footer__legal">
          <p>© {site.year} {site.legalName}. All rights reserved.</p>
          <p>{site.address.join(' ')}</p>
        </div>
      </div>
      <div className="site-footer__word" aria-hidden="true" />
    </footer>
  );
}

// Custom cursor: a dot plus a lagging ring. Fine pointers only.
export function Cursor() {
  const root = useRef(null), dot = useRef(null), ring = useRef(null);
  useEffect(() => {
    if (!finePointer() || reduceMotion()) return;
    let x = 0, y = 0, rx = 0, ry = 0, on = false, raf;
    const move = (e) => {
      x = e.clientX; y = e.clientY;
      if (!on) { on = true; rx = x; ry = y; root.current.classList.add('is-on'); }
      dot.current.style.transform = `translate3d(${x}px,${y}px,0)`;
      root.current.classList.toggle('is-hot', !!e.target.closest?.('a, button, summary, input, label, [data-magnetic], .flash'));
    };
    const leave = () => { on = false; root.current.classList.remove('is-on'); };
    const loop = () => { rx += (x - rx) * 0.16; ry += (y - ry) * 0.16; ring.current.style.transform = `translate3d(${rx}px,${ry}px,0)`; raf = requestAnimationFrame(loop); };
    addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    loop();
    return () => { removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="cursor" ref={root} aria-hidden="true">
      <i className="cursor__dot" ref={dot} />
      <i className="cursor__ring" ref={ring} />
    </div>
  );
}
