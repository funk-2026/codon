# D14 — Math & chemistry rendering

**Status:** Approved by the product owner (2026-10-25), pending the on-device performance check below.

## Decision
Typeset `$…$` / `$$…$$` on the device with **MathJax 3 (`mathjax-full`) → SVG**, drawn with **`react-native-svg`** (`src/rich/mathSvg.ts`, `src/rich/MathView.tsx`). TeX packages: `base`, `ams`, `mhchem` (chemical equations: `\ce{2H2 + O2 -> 2H2O}`).

## Options considered
| | Offline | Expo Go / no native module | Inline in text | Cost | Verdict |
|---|---|---|---|---|---|
| (a) One shared off-screen WebView running KaTeX, results cached | ✅ | ✅ | ✅ (via SVG/HTML strings) | async round-trip per formula; WebView lifecycle on every screen; no `mhchem` in KaTeX core | Rejected — more moving parts for the same output |
| **(b) MathJax → SVG in JS, react-native-svg** | ✅ | ✅ | ✅ (inline `View` in `Text`) | +~1.5–2 MB bytecode; first formula pays MathJax init | **Chosen** |
| (c) Pre-render at authoring time (formula → media image) | ✅ | ✅ | ✅ | needs a server renderer; formulas become uneditable images | Kept as the manual fallback (upload an image) |
| One WebView per formula | — | — | — | memory/jank on 30-formula tests | Rejected up front (spike brief) |

## How it behaves
- **Lazy + cached:** MathJax loads on the first formula; each `(tex, inline|display)` result is cached (500 entries), so Next/Prev never re-typesets.
- **Colour & size from context:** the SVG uses `currentColor` = the surrounding text colour (light/dark/wellness all work); size comes from the surrounding font (`1ex = 0.442 × fontSize`) and the baseline offset from MathJax's `vertical-align`.
- **Never breaks a question:** TeX MathJax rejects (or MathJax failing to load) falls back to the old monospace TeX chip.
- **Accessibility:** the TeX source is the label (`Formula: \frac{1}{2}mv^2`).

## Measured so far
- Node (dev laptop): 2–19 ms per formula, warm; `mhchem` reactions ~19 ms.
- Android Hermes bundle builds; bundle grew ~14 MB → ~15.9 MB (includes all other work of 2026-10-25).
- Unit tests: `src/rich/__tests__/mathSvg.test.ts`.

## Still to confirm on a device (spike criteria)
- 90-question test with 30 formula questions on a mid-range Android: first question < 1 s cold, no jank on Next/Prev.
- Memory stays flat while paging through formula questions.
- Airplane mode: formulas still render.
- Dark mode legible; TalkBack reads "Formula: …".

If any of these fail, the fallback is option (c): keep the renderer for previews and pre-render formulas server-side.
