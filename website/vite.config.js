import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The build is ONE self-contained file: dist/index.html (JS, CSS, fonts and images are inlined into it).
//  - works with no server: double-click it, drop it on any static host, or upload it to a bucket
//  - relative paths only (base './'), so it also works under a sub-folder
//  - hash routing inside the app (index.html#/about), so no host needs "send everything to index.html" rules
const singleFile = () => ({
  name: 'single-file',
  enforce: 'post',
  generateBundle(_, bundle) {
    const html = bundle['index.html'];
    const js = Object.keys(bundle).find((k) => k.endsWith('.js'));
    const css = Object.keys(bundle).find((k) => k.endsWith('.css'));
    if (!html || !js) return;
    const safe = (code) => code.replace(/<\/(script|style)/gi, '<\\/$1');
    let src = String(html.source)
      .replace(/<script[^>]*src="[^"]*\.js"[^>]*><\/script>/, '')
      .replace(/<link rel="stylesheet"[^>]*href="[^"]*\.css"[^>]*>/, '')
      .replace(/<link rel="modulepreload"[^>]*>/g, '');
    if (css) src = src.replace('</head>', () => `<style>${safe(bundle[css].source)}</style>\n</head>`);
    src = src.replace('</body>', () => `<script>${safe(bundle[js].code)}</script>\n</body>`);
    html.source = src;
    delete bundle[js];
    if (css) delete bundle[css];
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), singleFile()],
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
