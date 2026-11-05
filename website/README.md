# Codon website

A React website that is **fully static**: no server, no API, no database, no network requests.
Every fact, FAQ, legal text and sample value is hardcoded in `src/data/`.

## Use it

```bash
npm install        # once
npm run build      # writes dist/index.html
```

`dist/index.html` is a **single self-contained file** (JS, CSS, fonts and images are inlined). Open it by
double-clicking, or upload `dist/` to any static host (Netlify, Vercel, GitHub Pages, S3, Cloudflare Pages, a shared
host). It needs no server-side rules and works from a sub-folder.

(`npm run dev` starts Vite's hot-reload dev server. That is only a convenience for editing, never needed to run the site.)

## Pages (hash routing, so no server config is ever needed)

| Page | URL |
|---|---|
| Home | `index.html#/` |
| Marketing URL (the app tour) | `index.html#/marketing` |
| About us | `index.html#/about` |
| Contact us | `index.html#/contact` |
| FAQs | `index.html#/faqs`  (deep link: `#/faqs/refund`) |
| Privacy policy | `index.html#/privacy-policy` |
| Terms & conditions | `index.html#/terms` |
| Refund policy | `index.html#/refund-policy` |

Old links (`/Terms`, `/PrivacyPolicy`, `/AboutUs`, `/Faqs`, `/plans` …) are redirected by `public/404.html` on hosts that serve a
custom 404 page (Netlify, GitHub Pages, Cloudflare Pages, Vercel).

## Where to change things

| What | File |
|---|---|
| Email, phone, address, store links, nav, footer, doctors, sample quiz and chart values | `src/data/site.js` |
| FAQ questions and answers | `src/data/faq.js` |
| Privacy policy, Terms, Refund policy text | `src/data/legal.js` |
| Page layouts | `src/pages/*.jsx` |
| Interactive demos (sample test, chart, phone, decoder…) | `src/components/*.jsx` |
| Colours, type, spacing | top of `src/styles/main.css` |

Rebuild with `npm run build` after any change.

## Before going live: please check

1. **Privacy policy & Terms are drafts.** They were written from how the app behaves, because the old API endpoints were unreachable. Have your legal adviser review them (the Terms' governing law and liability cap are drafting choices), or paste approved wording into `src/data/legal.js`.
2. `playStore` in `src/data/site.js`: the app config uses `com.codon.learn`; the old site linked `com.codon.app`. Add `appStore` when the iOS listing exists (the button is hidden while empty).
3. The company name is "CodON Health Private Limited" everywhere (the old Contact page said "CodON Academy Pvt. Ltd.").
4. The doctors list is hardcoded with the two people named in the old copy. Add more in `src/data/site.js` (`faculty`).
5. **Search engines:** hash URLs (`#/about`) are not indexed as separate pages. This suits a store-listing / app-support site; if SEO per page matters later, the pages can be pre-rendered.
