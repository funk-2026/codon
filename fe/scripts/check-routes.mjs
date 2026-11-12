// Fails if any literal in-app route string points at a screen file that doesn't exist.
// Run: node scripts/check-routes.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : walk(p)) : [p];
});
const files = [...walk('app'), ...walk('src')].filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__'));
const RE = /['"`](\/\((?:student|teacher|admin)\)[^'"`?${\s]*)/g;
let bad = 0;
for (const f of files) {
  // Comments may legitimately mention retired routes (see normalizeRoute), so skip them.
  const s = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  for (const m of s.matchAll(RE)) {
    const route = m[1].replace(/\/$/, '');
    const base = join('app', route);
    const ok = ['.tsx', '/index.tsx', '.ts'].some((ext) => existsSync(base + ext))
      || (existsSync(base) && statSync(base).isDirectory());
    if (!ok) { bad++; console.log(`${f}: ${route}`); }
  }
}
console.log(bad ? `${bad} broken route(s)` : 'all route literals resolve');
process.exit(bad ? 1 : 0);
