import { Router, useRoute } from './lib/router';
import { usePageMotion } from './lib/hooks';
import { Cursor, Footer, Header } from './components/Layout';
import Home from './pages/Home';
import Marketing from './pages/Marketing';
import About from './pages/About';
import Contact from './pages/Contact';
import Faqs from './pages/Faqs';
import { Privacy, Refund, Terms } from './pages/Legal';
import NotFound from './pages/NotFound';

const ROUTES = {
  '/': Home,
  '/marketing': Marketing,
  '/about': About,
  '/contact': Contact,
  '/faqs': Faqs,
  '/privacy-policy': Privacy,
  '/terms': Terms,
  '/refund-policy': Refund,
};

function Shell() {
  const { path } = useRoute();
  const Page = ROUTES[path] || NotFound;
  usePageMotion(path);
  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <div className="grain" aria-hidden="true" />
      <Cursor />
      <Header />
      <main id="main" tabIndex={-1}>
        <Page key={path} />
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Shell />
    </Router>
  );
}
