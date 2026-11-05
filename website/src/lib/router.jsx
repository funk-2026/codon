import { createContext, useContext, useEffect, useState } from 'react';

// Tiny hash router: URLs look like  index.html#/about  or  index.html#/faqs/refund
// Hash routing needs NO server rules, so the site works on any static host (or from a folder on disk).
const parse = () => {
  const [path = '', ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  return { path: '/' + path, sub: rest.join('/') };
};

const RouteCtx = createContext({ path: '/', sub: '' });
export const useRoute = () => useContext(RouteCtx);

export function Router({ children }) {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return <RouteCtx.Provider value={route}>{children}</RouteCtx.Provider>;
}

export const Link = ({ to, children, ...rest }) => (
  <a href={'#' + to} {...rest}>
    {children}
  </a>
);

// An in-page jump (the hash is reserved for routing, so this scrolls instead of changing the URL)
export const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
export const ScrollLink = ({ to, children, ...rest }) => (
  <a href={'#/'} onClick={(e) => { e.preventDefault(); scrollToId(to); }} {...rest}>
    {children}
  </a>
);
