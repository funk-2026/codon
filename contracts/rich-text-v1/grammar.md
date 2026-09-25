# Rich text v1 — grammar

A **closed** subset of markdown for question stems, options, explanations, Brain Hacks, flashcards and notes.
No HTML, no link syntax: anything not listed here is rendered as **literal text**, so there is no injection surface.

A field's `content_format` decides whether it is parsed: `plain` (all legacy rows) is **never** interpreted; `rich_v1` is.

## Blocks (separated by blank lines)
| Syntax | Node |
|---|---|
| paragraph text | `paragraph` — a single newline inside a paragraph is a `break` |
| `- item` / `* item` (line start, followed by a space) | `list` (unordered) — one item per line |
| `1. item` | `list` (`ordered: true`) |
| `$$ … $$` on its own (may span lines) | `math_block` |
| a paragraph that is only `![alt](media:<uuid>)` | `image_block` |

## Inlines
| Syntax | Node |
|---|---|
| `**bold**`, `*italic*` (nestable) | `text` with `bold` / `italic` |
| `~sub~`, `^sup^` (no spaces inside) | `sub` / `sup` |
| `$tex$` (no spaces just inside the `$`; a closing `$` followed by a digit is *not* a closer, so `$5 and $10` is currency) | `math` |
| `![alt](media:<uuid>)` (uuid lower-cased) | `image` |
| `\` + one of `\ * ~ ^ $ ! [ ] _` | literal character |

An opening delimiter without a valid closer is literal text. Emphasis never crosses paragraphs.

## Projections
* `plain` — text content only: math → its TeX, images → `[image]`, blocks joined by `\n`.
* `refs` — the unique media ids referenced (rich format only).
* `normalize` (server-side, for duplicate detection) — NFKC, lower-case, whitespace collapsed.

## Validation (server)
`TOO_LONG`, `HTML_NOT_ALLOWED` (script/iframe/img/a/… tags), `LINKS_NOT_ALLOWED` (`](javascript:`, `](https://`, `[x](scheme://…)`), `UNKNOWN_MEDIA_SCHEME` (an image whose source is not `media:`), `BAD_MEDIA_ID`, `TOO_MANY_IMAGES`.

Golden vectors: `vectors.json` — **both** parsers must reproduce `ast`, `plain` and `refs` exactly.
