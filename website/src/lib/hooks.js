import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { finePointer, reduceMotion } from './utils';

// Fires once when the element is at least `threshold` visible. Returns [ref, seen].
export function useInView(threshold = 0.4) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) return setSeen(true);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen];
}

// Per-page <title> and description
export function useMeta(title, description) {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}

/**
 * Page-level motion, wired to the markup's data-attributes:
 *  data-reveal / data-lines / data-inview / data-stagger  -> scroll reveals
 *  data-parallax                                          -> depth on scroll + pointer
 *  data-magnetic                                          -> buttons pulled toward the pointer
 * Runs after every route change (the page remounts, so the new elements are picked up).
 */
export function usePageMotion(routeKey) {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    const reduce = reduceMotion();
    const els = [...document.querySelectorAll('[data-reveal],[data-lines],[data-inview]')];
    document.querySelectorAll('[data-lines]').forEach((l) => l.querySelectorAll('.line').forEach((x, i) => x.style.setProperty('--d', i)));
    document.querySelectorAll('[data-stagger]').forEach((g) =>
      [...g.children].forEach((c, i) => { c.setAttribute('data-reveal', c.getAttribute('data-reveal') || ''); c.style.setProperty('--d', i); els.push(c); }),
    );
    if (reduce || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [routeKey]);

  useEffect(() => {
    const fine = finePointer(), reduce = reduceMotion();
    requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('loaded')));
    const para = [...document.querySelectorAll('[data-parallax]')];
    let mx = 0, my = 0, tx = 0, ty = 0, ticking = false;
    const base = new Map(para.map((el) => [el, getComputedStyle(el).transform === 'none' ? '' : getComputedStyle(el).transform]));
    const render = () => {
      ticking = false;
      tx += (mx - tx) * 0.08; ty += (my - ty) * 0.08;
      para.forEach((el) => {
        const k = parseFloat(el.dataset.parallax) || 0.1, r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) return;
        const y = (r.top + r.height / 2 - innerHeight / 2) * -k * 0.35;
        el.style.transform = `${base.get(el)} translate3d(${tx * k * 28}px, ${y + ty * k * 20}px, 0)`;
      });
      if (Math.abs(mx - tx) > 0.001 || Math.abs(my - ty) > 0.001) request();
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(render); } };
    const onMove = (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; request(); };
    if (para.length && !reduce) {
      addEventListener('scroll', request, { passive: true });
      if (fine) addEventListener('pointermove', onMove, { passive: true });
      request();
    }

    // magnetic buttons (delegated, so it also covers buttons rendered later)
    let cur = null;
    const onMag = (e) => {
      const el = e.target.closest?.('[data-magnetic]');
      if (cur && cur !== el) { cur.style.transform = ''; cur = null; }
      if (!el) return;
      cur = el;
      const r = el.getBoundingClientRect();
      el.style.transform = `translate3d(${(e.clientX - (r.left + r.width / 2)) * 0.28}px,${(e.clientY - (r.top + r.height / 2)) * 0.4}px,0) scale(1.035)`;
    };
    if (fine && !reduce) document.addEventListener('pointermove', onMag, { passive: true });

    return () => {
      removeEventListener('scroll', request); removeEventListener('pointermove', onMove);
      document.removeEventListener('pointermove', onMag);
    };
  }, [routeKey]);
}
