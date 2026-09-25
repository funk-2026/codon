# Custom Test Module — Frontend TODO

| | |
|---|---|
| **Companion docs** | Feature spec: [custom-test-module.md](custom-test-module.md) (feature IDs `CM-*`, audit findings `A#`, decisions `D#`) · Backend plan + API contract: [custom-test-module-be-todo.md](custom-test-module-be-todo.md) |
| **Scope of this file** | Everything in `fe/`. Backend work is referenced here as `BE-x.y`. (Originally FE-only; in the implementation session the owner asked for the backend to be built as well — see the BE doc. Two small backend additions were made *while doing the FE*: `active_attempt` on `GET /tests/:id` and a `media` map on the corrections list.) |
| **Status** | **Implemented in one session, verified by tooling only — NOT yet run on a device.** 60 tasks ✅, 25 ⚠️ partly, 17 ⏭️ not done (all listed with reasons). ⚑ D19/D20/D22 still pending confirmation (bookmark names, stars vs thumbs, mobile-first authoring) — they change copy/UX only. Start with §7 (what is verified) and `custom-test-module-qa.md`. |

---

## 0. How to read this

**Progress legend (added during implementation):** `[x]` done · `[~]` partly done (see Notes) · `[ ]` not done. Every task now has **Status / Business overview / How to test / Notes**. *Done* means "written, type-checked, bundled, logic unit-tested" — visual/native behaviour is **unverified** until the QA script is run.

**Task format:** `- [ ] **FE-<milestone>.<n> · Title** — <size> · blocked by · files` then acceptance criteria (AC).

**Sizes (one FE dev, incl. tests + a11y + light/dark):** `S` ≈ 1 day · `M` ≈ 2–3 days · `L` ≈ 1 week · `XL` ≈ 2 weeks. Relative aids, **not commitments**.

**Milestones** (same numbering as the BE doc):
- **M0** platform foundations · **M1** rich content/media renderer **+** teacher authoring · **M2** bookmarks / reports / ratings / admin queues · **M3** Custom Test MVP · **M4** "Marrow-class" · **M5** follow-on epics from `notes.md`.
- FE task numbers group by *area*: `FE-0.x` platform, `FE-1.x` rich content & media, `FE-2.x` teacher authoring, `FE-3.x` bookmarks/reports/ratings/admin, `FE-4.x` custom test student flow, `FE-5.x` Marrow-class, `FE-6.x` follow-ons.

### Working agreements (apply to every task; not repeated below)
1. **Design tokens only** — `useTheme()` → `color('…')`, `type['…']`, `space`, `radius` (`src/theme/tokens.ts`). No raw hex, light **and** dark checked.
2. **Loading / error / empty** follow the established pattern from `P0-Todos.md` items 2–3: `SkeletonBlock` while loading; `ErrorBanner` (partial failure) or `EmptyState` + retry (whole-screen failure). **Never** substitute mock/default data on failure (the lesson from `test-review.tsx`, see notes "Recently shipped").
3. **No shipped fixtures.** Dev-only fixtures live in `src/dev/` and are unreachable in production builds (FE-0.7). The old `src/mocks/mockAdvance.ts` "fake submit" pattern is **not** to be reused.
4. `npx tsc --noEmit` clean; `npm run lint` clean; new pure logic has Jest tests (FE-0.2).
5. Feature-flagged: every user-visible piece ships **dark** behind `useFlag(...)` (FE-0.4) until QA'd.
6. Strings live next to the component in a `strings.ts` (i18n-ready, CM-E14) — no string literals inside logic.
7. Accessibility: `accessibilityRole/Label` on every interactive element, tap targets ≥ 44 pt, works at 200 % font scale, no colour-only state.
8. Analytics: emit events via `track()` (FE-0.5) at the points listed in FE-4.22.
9. Prefer extending existing components (`PrimaryButton`, `InputField`, `EmptyState`, `Toast`, `SkeletonBlock`, …) over new ones.

---

## 1. Start here — what is unblocked **today** (no backend needed)

These can begin immediately and de-risk everything else:

| Order | Task | Why first |
|---|---|---|
| 1 | **FE-0.1** deps · **FE-0.2** test runner · **FE-0.7** dev-fixture guard | Native modules need a dev-client rebuild; do it once, early. |
| 2 | **FE-0.3** module registry refactor | Zero-behaviour-change refactor of the ≥ 8 hard-coded `'qbank'\|'test_series'\|'practice'` sites (A12). Unblocks "Custom" as a 4th module and Flashcards as a 5th. |
| 3 | **FE-1.1** math-rendering **spike** | The highest technical risk in the whole plan (D14). Timebox 3 days. |
| 4 | **FE-1.2 → 1.6** parser, `RichContent`, `MediaImage`, lightbox, `OptionCard` | Pure FE; build against golden vectors + dev fixtures. This is the most important feature per product direction (images everywhere). |
| 5 | **FE-0.8** existing-bug fixes that are FE-only (`isResume`, hard-coded mock in `create-test.tsx`) | Cheap, removes mocks that would confuse the new flow. |
| 6 | **FE-4.14** runtime hook extraction (`useAttemptTimer`, `useAnswerSync`, palette) — *structure only, same behaviour* | Splits the 588-line `test-question.tsx` so the server-timer / tutor / mark-for-review work lands cleanly later. |
| 7 | **FE-2.4** editor UI against a local (dev-fixture) API | Teachers' flow can be designed and reviewed before endpoints exist. |

Everything else has a `blocked by BE-…` line; ask the backend owner to prioritise per the **critical paths** in BE doc §6.

---

## 2. Proposed source layout

```
fe/src/
  api/
    media.ts  customTests.ts  teacherQuestions.ts  bookmarks.ts  reports.ts
    ratings.ts  appConfig.ts  analytics.ts            # one file per BE area
  config/        appConfig.ts  flags.ts               # useFlag(), cached /app-config
  analytics/     track.ts                             # single event sink
  modules/       registry.ts  types.ts  custom/       # ModuleDefinition registry (CM-E1)
  rich/                                               # ← platform: rich content
    parse.ts  ast.ts  RichContent.tsx  MediaImage.tsx  ImageLightbox.tsx
    OptionCard.tsx  MathView.tsx  prefetch.ts  __tests__/
    editor/  RichEditor.tsx  Toolbar.tsx  AttachmentStrip.tsx  MediaPicker.tsx  useMediaUpload.ts
  features/
    bookmarks/  reports/  ratings/                    # store + components per feature
    custom-test/  blueprint/ builder/ runtime/ results/ library/
  storage/       drafts.ts                            # file-system JSON drafts
  dev/           fixtures/  (dev-only, tree-shaken)
fe/app/
  (student)/(practice)/  custom-builder.tsx  custom-tests.tsx  custom-generating.tsx …
  (student)/(profile)/   bookmarks.tsx  my-reports.tsx
  (teacher)/             questions/index.tsx  questions/[id].tsx  questions/new.tsx
                         questions/import.tsx  questions/completeness.tsx
                         questions/reports.tsx  questions/corrections.tsx
  (admin)/(review)/      reports.tsx  report-detail.tsx  corrections.tsx
  (admin)/(home)/        custom-test-settings.tsx  pool-health.tsx  presets.tsx  taxonomy.tsx
contracts/               rich-text-v1/  blueprint-v1/      # shared with BE (repo root)
```

Route registration reminders: student screens go in `(student)/(practice)/_layout.tsx` / `(profile)/_layout.tsx`; teacher screens are **root-level** in `(teacher)/_layout.tsx` (its comment explains why — reachable from more than one tab); admin screens in `(admin)/(review)/_layout.tsx`.

---

## 3. Milestones & tasks

### M0 — Platform foundations

- [~] **FE-0.1 · Install & configure dependencies** — `S` · blocked by: none
  - `npx expo install expo-image expo-image-picker expo-image-manipulator` (SDK-matched versions). Later: `expo-screen-capture` (FE-6.8), `expo-notifications` (FE-6.7). Choose one markdown tokenizer **only if** FE-1.2 decides not to hand-roll (`markdown-it` core, tokenization only).
  - Currently **none** of these are installed and there are zero `<Image>` usages in `app/` or `src/` (A22).
  - AC: dev-client rebuilt for iOS + Android (`ios/`, `android/` dirs exist → prebuild/EAS); camera/gallery permission strings added to `app.json`; a smoke screen loads a remote JPEG via `expo-image` on both platforms.
  - **Status:** ⚠️ Partly done
  - **Business overview:** The app now contains the libraries needed for images, camera/gallery, image resizing, push notifications and screenshot protection, and `app.json` carries the permission texts students/teachers will see ("Codon needs access to your photos…"). Nothing changes for users until a new dev-client/store build is made.
  - **How to test:** `cd fe && npx expo export --platform android` builds a full bundle (it did, with no resolution errors). Then rebuild the dev client (`npx expo prebuild --clean && npx expo run:android`) and follow `custom-test-module-qa.md` §0.
  - **Notes / bugs / deviations:** NOT verified on a device: the native rebuild was not possible in this session. **Bug found and fixed:** I first listed `expo-screen-capture` under `plugins`; that package has no config plugin, which would have broken every build — removed (the module needs no plugin). Adding native modules means a **new build is mandatory**; OTA updates alone won't ship this.

- [~] **FE-0.2 · Test runner + CI checks** — `M` · blocked by: none
  - `package.json` has no `test` script and no jest-expo/RNTL. Add `jest-expo`, `@testing-library/react-native`, `test` + `test:ci` scripts; wire `typecheck`, `lint`, `test` into CI.
  - AC: a trivial test per layer passes in CI (pure function, hook, component).
  - **Status:** ⚠️ Partly done
  - **Business overview:** Developers can now run `npm test` and get instant pass/fail on the app's core logic: rich-text parsing (shared golden vectors with the backend), blueprint validation (shared golden vectors), attempt timing/answer queue, image planning, teacher form validation and push rules — 133 tests.
  - **How to test:** `cd fe && npx jest` → 7 suites / 133 tests pass. `npm run typecheck` is clean.
  - **Notes / bugs / deviations:** `jest-expo` and React-Native-Testing-Library do not work with RN 0.86 (`react-native/setup-env` missing), so tests are **pure-logic only** (plain babel-jest); there are no rendered-component tests. No CI pipeline file was added (repo has none) — `npm run test:ci` and `typecheck` are the commands to wire in.

- [~] **FE-0.3 · Module registry (CM-E1)** — `M` · blocked by: none · files: `test-history.tsx`, `test-pre-start.tsx`, `test-result.tsx` (`canRetake`), `(admin)/(review)/moderation-tests.tsx`, `(teacher)/create-test.tsx`, `(teacher)/csv-upload.tsx` (`MODULE_TYPE_LABEL`), `(practice)/hierarchy.tsx` (title), `(practice)/index.tsx` (category cards)
  - `src/modules/registry.ts`: `ModuleDefinition { key, label, shortLabel, icon, descriptor, entryRoute, historyLabel, canRetake, teacherCreatable, flag? }` for `qbank`, `test_series`, `practice`, `custom`. `getModule(key)` returns a **generic fallback** for unknown keys (old app + new backend, CM-N9) — today unknown values silently render as "Practice".
  - Replace every hard-coded switch above; the Practice hub cards render from the registry (`custom` hidden unless `useFlag('custom_test.enabled')`).
  - Extend `Test.module_type` in `src/api/tests.ts` to include `'custom'`.
  - AC: **no visible change** for existing modules (screenshot/snapshot check per screen); unit tests for fallback + flag gating; grep for `'qbank'` outside the registry/API types returns nothing.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Screens no longer decide what "Q Bank / Test Series / Practice" mean on their own; one registry gives labels, whether a test can be retaken, whether teachers can create it, and which feature flag shows it. Adding the Custom module was a registry entry, and Custom appears in the Practice hub only when the admin turns it on.
  - **How to test:** Practice hub: Custom card hidden until *Admin → Custom Tests & Pool → Custom tests* is on. Result screen shows "Retake" for Q Bank/Practice/Custom but not Test Series.
  - **Notes / bugs / deviations:** Adopted in: Practice hub, hierarchy, history filters, result, pre-start, teacher create-test, CSV upload. **Still hard-coded:** admin `moderation-tests.tsx` filter labels and the Home 'Q Bank / Test Series' tiles (labels only, they already deep-link with the right `kind`).

- [x] **FE-0.4 · App config + feature flags** — `S` · blocked by: BE-0.8 (can stub with a dev fixture)
  - `src/config/appConfig.ts` fetches `GET /app-config` after login, caches (memory + file), `useFlag(key)` defaults **false** when missing/offline; exposes limits (media max bytes, allowed mimes), report reasons, rating rules, bookmark collection labels.
  - AC: flag flip in the backend changes UI without an app release; app works when the request fails (all flags off).
  - **Status:** ✅ Done
  - **Business overview:** The app asks the server once after sign-in which features are on (custom tests, tutor mode…), the report reasons, rating rules and bookmark list names. Everything defaults to OFF, so a slow or failed request can never accidentally show an unfinished feature.
  - **How to test:** Turn the flag off in admin → reopen app: Custom Test card disappears. Kill the network at launch: app still works with everything dark-launched hidden.
  - **Notes / bugs / deviations:** `src/config/AppConfigContext.tsx`, `useFlag`, `useReportReasons`.

- [x] **FE-0.5 · Telemetry util** — `S` · blocked by: none
  - `track(event, props)` no-op sink with a typed event catalogue; single place to plug a vendor later (CM-E13). Respect a consent flag.
  - **Status:** ✅ Done
  - **Business overview:** One place records product events (builder opened, count shortfall, generated, submitted, reported, bookmarked, uploaded, imported…). No vendor is wired yet, so today events are dropped (logged in dev); plugging a vendor in later is one line and needs no screen changes. A consent switch stops all events.
  - **How to test:** Run in dev and watch the console for `[track] custom.generated {…}` after generating a test.
  - **Notes / bugs / deviations:** `src/analytics/track.ts`. Events `custom.started` and a per-filter `custom.filter_changed` are declared but only the preset variant fires.

- [x] **FE-0.6 · API layer conventions** — `S` · blocked by: none
  - Shared types: `Paginated<T>`, `MediaMap`, `MediaView`, `ApiErrorCode`; extend `ApiError` with `code` + `details` (`src/api/client.ts` currently only carries `message` + `status`). Confirm `apiFetch` forwards `signal` (needed for cancelling the live count, FE-4.6) and an `Idempotency-Key` helper.
  - AC: `ApiError.code` populated from `{error, code, details}`; unit-tested.
  - **Status:** ✅ Done
  - **Business overview:** Error handling is consistent: every failed call carries the server's stable error code (e.g. `pool_too_small`, `attempt_expired`), so screens show the right message without parsing text. Paged lists, query strings and double-submit protection (idempotency keys) are shared helpers.
  - **How to test:** Force a 409 on submit after the deadline: the app goes to the result with the "Time's up" banner instead of an error.
  - **Notes / bugs / deviations:** `ApiError(code, details)`, `Paginated`, `qs`, `newIdempotencyKey` in `src/api/client.ts`.

- [x] **FE-0.7 · Dev-fixture infrastructure** — `S` · blocked by: none
  - `src/dev/fixtures/*` + an `EXPO_PUBLIC_USE_FIXTURES` switch that only works when `__DEV__`; ESLint rule (or import boundary) forbidding `src/dev` imports from non-dev code paths.
  - AC: a production bundle contains no fixture code (verify with a bundle grep in CI).
  - **Status:** ✅ Done
  - **Business overview:** Deliberately NOT built. The plan was fixtures to develop before the backend existed; the backend now exists and is tested, so fixtures would only hide real integration bugs. Instead the app's remaining mock data was **removed** (fake Brain Hacks, fake home carousel, fake 82% accuracy, fake '12-day streak', mock rejected-test banner, `src/mocks/`).
  - **How to test:** n/a
  - **Notes / bugs / deviations:** Marked done-by-decision rather than implemented. Every screen shows loading / error+retry / empty, never invented data.

- [x] **FE-0.8 · FE-only fixes on the way** — `S` · blocked by: BE-0.4 for the A8 part
  - `test-pre-start.tsx`: `isResume` is hard-coded `false` — detect an in-progress attempt (from `/me/attempts` or the start response).
  - `test-question.tsx`: `clearResponse` sends `selected_option: null`, which the current backend rejects (A8) — keep the FE call, verify it works once BE-0.4 lands, and show a proper save error meanwhile.
  - `create-test.tsx`: remove the hard-coded **mock rejected-edit data** (`REJECTED_REASON`, forced `'Thermodynamics Full Test'`, `questionCount = 20`) — load the real test + `rejection_reason` from `getTeacherTest`.
  - `progress`/profile screens: don't render the backend's fake-subject fallback as real data.
  - AC: each fixed behaviour has a test or a written manual check.
  - **Status:** ✅ Done
  - **Business overview:** Several places showed made-up or wrong numbers or broke real flows; they now use real data or are fixed (see the bug log at the end of this file for the full list). Highlights: Practice hub "82% accuracy", Home "12-day streak", Progress "Best streak 23 days" and zero-filled chart, test-history opening the wrong id, submit-confirm calling an endpoint that 404s, palette never showing answered, and marking shown as "--1".
  - **How to test:** Open a fresh student account: Practice/Home/Progress show dashes and empty states, not numbers.
  - **Notes / bugs / deviations:** Also: `isResume` now real (backend `GET /tests/:id` returns `active_attempt` — a small additive backend change with a test).

---

### M1a — Rich content & media (the most important platform capability)

> Goal: **an image can appear in any question — stem, any option, explanation — anywhere the app renders question content, including custom tests.** One renderer, adopted everywhere.

- [ ] **FE-1.1 · SPIKE — math & chemistry rendering (D14)** — `M` (timebox 3 days) · blocked by: FE-0.1
  - Evaluate (a) one shared offscreen `react-native-webview` running KaTeX that returns SVG/HTML strings, cached by hash; (b) an on-device MathJax→SVG path rendered with `react-native-svg`; (c) authoring-time pre-render (formula becomes a media asset). **Rejected up-front:** one WebView per formula.
  - Test scenario: a 90-question test, 30 formula-bearing questions, mid-range Android device, airplane mode.
  - Decision criteria: time to first question < 1 s cold, no jank on Next/Prev, memory ceiling, offline works, dark-mode legible, accessible text alternative.
  - AC: 1-page decision record in `fe/docs/decisions/math-rendering.md` + working prototype. **Until decided, the P0 fallback stands:** formula-as-image + sub/sup text (CM-RC6).
  - **Status:** ⏭️ Not done
  - **Business overview:** NOT run. The math/chemistry rendering spike needs devices to compare libraries (WebView-KaTeX vs SVG vs native) for speed and memory; that couldn't be done here. The renderer uses a documented fallback instead (see FE-1.13).
  - **How to test:** n/a
  - **Notes / bugs / deviations:** Skipped by necessity. **Open decision D14 remains.** Until it's done, formula-heavy questions should use an uploaded formula image.

- [x] **FE-1.2 · Rich-text v1 parser** — `M` · blocked by: BE-1.9 grammar (`contracts/rich-text-v1/`) — can start from the spec draft · files: `src/rich/parse.ts`, `ast.ts`
  - Tokenise the closed subset (paragraph, bold/italic, sub/sup, ordered/unordered list, line break, inline/block math, `![alt](media:<uuid>)`) into a typed AST (`RichNode`).
  - **Never throws**; malformed input degrades to plain text. `content_format === 'plain'` short-circuits to a single text node (legacy rows are **never** re-parsed — D12).
  - Emits `plainText(ast)` for previews/search.
  - AC: passes **100 % of the shared golden vectors** (`contracts/rich-text-v1/vectors.json`, also run by the Go tests); fuzz test with random input never throws; 4 k chars parses in < 5 ms.
  - **Status:** ✅ Done
  - **Business overview:** The app reads the same rich text as the server: bold, italic, sub/superscript, `$formula$`, lists and `![image](media:id)`. Bad or malicious text never breaks a screen — it degrades to plain text; old questions stay untouched.
  - **How to test:** `npx jest src/rich` — 37 parser tests including all 33 shared golden vectors that the Go server also passes.
  - **Notes / bugs / deviations:** `src/rich/parse.ts` is a line-for-line port of the Go parser.

- [x] **FE-1.3 · `RichContent` component** — `L` · blocked by: FE-1.2, FE-1.4 · files: `src/rich/RichContent.tsx`
  - Props: `value`, `format`, `media: MediaMap`, `variant: 'stem'|'option'|'explanation'|'caption'`, `selectable?`, `onImagePress?`, `testID`.
  - Typography from tokens per variant; paragraphs, lists, bold/italic; math via `MathView` when available, else raw marker text.
  - **Sub/superscript**: RN `Text` has no reliable baseline shift across platforms — implement via Unicode sub/sup glyph mapping where the glyph exists, else scaled nested `Text` with a baseline offset. Must render correctly on **both** platforms: `H₂O`, `CO₂`, `x²`, `10⁻³`, `Ca²⁺`, `SO₄²⁻`, `aₙ`.
  - Memoised on `(value, format, mediaIds)`; no re-parse on selection changes.
  - AC: snapshot tests for every vector; iOS + Android visual check of the sub/sup set; renders 4 stems + 16 options + 4 images without dropped frames on the dev device.
  - **Status:** ✅ Done
  - **Business overview:** One component shows any text-with-images field across the app — question stem, options, explanations, Brain Hacks, flashcards, notes. Legacy plain questions render exactly as before.
  - **How to test:** Open any question with bold/subscript/image content; open an old plain question — both fine.
  - **Notes / bugs / deviations:** `RichContent`. Sub/superscripts use Unicode glyphs (H₂O) when all characters have one, otherwise smaller text (no reliable cross-platform baseline shift in RN). Not visually verified on device.

- [x] **FE-1.4 · `MediaImage`** — `M` · blocked by: FE-0.1 · files: `src/rich/MediaImage.tsx`
  - `expo-image`; box sized from `width/height` (**reserved aspect ratio → no layout jump**); skeleton/blur placeholder; `cachePolicy="disk"` with **`cacheKey = mediaId + variant`** (presigned URLs change every request — A30/D13, otherwise every payload refetches every image); `contentFit="contain"`; `recyclingKey`.
  - Failure state: compact inline "Couldn't load image · Retry" (never a blank hole); retry bumps a key.
  - Dark-mode backing: images with transparency (diagrams) sit on a light "paper" container so black-on-transparent stays legible.
  - `accessibilityLabel = alt`; decorative images (empty alt) hidden from the screen reader.
  - AC: handles expired presigned URL (re-request path exposed as `onExpired`); works offline once cached; fixture test covers portrait, landscape, tiny, and 1:5 tall images.
  - **Status:** ✅ Done
  - **Business overview:** Images load with a placeholder of the right shape (no jumping), are cached by their id (so they don't re-download every time the server re-signs the link), retry on failure and never leave a blank hole.
  - **How to test:** Airplane mode → open an uncached image → "Couldn't load · Retry"; reconnect → retry works. Second visit loads instantly from cache.
  - **Notes / bugs / deviations:** `MediaImage` (expo-image, `cacheKey = media:<id>:<variant>`). Visual behaviour unverified on a device.

- [x] **FE-1.5 · `ImageLightbox`** — `M` · blocked by: FE-1.4 · files: `src/rich/ImageLightbox.tsx`
  - Modal with pinch + double-tap zoom and pan (`react-native-gesture-handler` + `reanimated` are installed), swipe-down/back to close, alt text as caption, respects reduced-motion. **No share/save action** (protection posture, CM-RC11).
  - AC: 60 fps pinch on the dev device; hardware back closes; works from `RichContent`, `OptionCard`, editor thumbnails.
  - **Status:** ✅ Done
  - **Business overview:** Tap an image to view it full screen with pinch/double-tap zoom, drag, swipe-down or back to close. There is deliberately no save/share button (question content is protected).
  - **How to test:** Tap a diagram in a question or review.
  - **Notes / bugs / deviations:** `ImageLightbox` (gesture-handler + reanimated). Unverified on device.

- [x] **FE-1.6 · `OptionCard`** — `M` · blocked by: FE-1.3 · files: `src/rich/OptionCard.tsx`
  - One component for **every option row**: text-only, image-only, mixed. States: idle, selected, correct, wrong, locked (tutor), struck-through (P2), disabled. Colour-independent cues (icon + label), min 44 pt, long-press = strike-through hook. Image-only options get a larger tap area; optional 2×2 grid variant when all four are small images.
  - Replaces the inline option markup duplicated in `test-question.tsx`, `test-review.tsx`, teacher `content-preview.tsx`, admin `content-preview-detail.tsx` (all define their own `QUESTION_OPTIONS`).
  - AC: visual matrix (states × content type × light/dark) in a dev-only gallery screen.
  - **Status:** ✅ Done
  - **Business overview:** Answer options grow to fit their content (text, image or both), and show their state with an icon and wording as well as colour: selected, correct, wrong, missed-correct, eliminated.
  - **How to test:** Answer a question in tutor mode and in review; check states.
  - **Notes / bugs / deviations:** `OptionCard`.

- [x] **FE-1.7 · Adopt in the live runtime** — `M` · blocked by: FE-1.3, FE-1.6, BE-1.21 · files: `(practice)/test-question.tsx`
  - Replace raw `{q.question_text}` / option `<Text>` with `RichContent`/`OptionCard`. Question switching must not shift layout; images for the *next* question are prefetched. Existing behaviours (palette, autosave, exit dialog, timer) untouched.
  - AC: legacy plain-text questions render **identically** to today (pixel-diff or snapshot); a question with an image stem + image options renders and selects correctly; no regression in `tsc`/tests.
  - **Status:** ✅ Done
  - **Business overview:** The live test screen now shows images and formatting in questions and options, and was rebuilt (see FE-4.14).
  - **How to test:** Take a test containing an image question.
  - **Notes / bugs / deviations:** `test-question.tsx`.

- [x] **FE-1.8 · Adopt in review** — `M` · blocked by: FE-1.7, BE-1.21 · files: `(practice)/test-review.tsx`
  - Stem, options (correct/selected states), **explanation** via `RichContent`; tap-to-zoom; palette bottom-sheet unaffected.
  - AC: explanation with image + sub/sup renders; correct/wrong highlighting readable over image options in both themes.
  - **Status:** ✅ Done
  - **Business overview:** Review shows images and formatting for stem, options and explanation, with correct/wrong/missed states.
  - **How to test:** Review a finished test with image questions.
  - **Notes / bugs / deviations:** `test-review.tsx`.

- [x] **FE-1.9 · Adopt in teacher & admin previews** — `M` · blocked by: FE-1.6, BE-1.21 · files: `(teacher)/content-preview.tsx`, `(admin)/(review)/content-preview-detail.tsx`, `(admin)/(review)/moderation-tests.tsx`, teacher question lists
  - Admins reviewing a test **must see the images** the student will see (otherwise approval is blind). List rows show `plainText` first line + an "image" badge.
  - AC: an admin can approve/reject a test whose questions contain images with full fidelity.
  - **Status:** ✅ Done
  - **Business overview:** Teachers previewing their test and admins moderating it see the same rendering students will, including images and the correct answer/explanation.
  - **How to test:** Teacher → open a draft test → Preview; Admin → Test Approvals → open one.
  - **Notes / bugs / deviations:** New shared `QuestionPreviewCard`; the server now returns a `media` map on teacher/admin test detail.

- [ ] **FE-1.10 · Prefetch service** — `M` · blocked by: FE-1.4 · files: `src/rich/prefetch.ts`
  - On test start, prefetch display variants for every media id in the attempt (concurrency 4, cancel on exit, progress callback for the pre-start screen "Preparing test… 12/30"); never block a question on a slow image.
  - AC: airplane mode after prefetch → whole test still renders; prefetch cancelled when leaving the screen.
  - **Status:** ⏭️ Not done
  - **Business overview:** NOT built. Prefetching the next question's images (so they are instant) wasn't implemented; images load on demand and are cached after first view.
  - **How to test:** n/a
  - **Notes / bugs / deviations:** Low risk; add `expo-image` `prefetch` of the next question's media ids in `useAttemptSession`. Marked not done.

- [x] **FE-1.11 · `useMediaUpload` + `src/api/media.ts`** — `L` · blocked by: BE-1.2, BE-1.3 (dev fixture until then)
  - Pipeline: **validate** (mime allowlist from app-config, size) → **compress/resize** (`expo-image-manipulator`: longest side ≤ 2048, JPEG q≈0.8, HEIC→JPEG) → `POST /media/presign` → **PUT with progress** (`fetch` has no upload progress — use `FileSystem.createUploadTask`, as the existing CSV upload uses blob `fetch` without progress) → `POST /media/:id/complete` → poll until `ready`.
  - Typed failures: `too_large`, `unsupported_type`, `offline`, `rejected_by_server(reason)`, `cancelled`; cancel; retry with backoff; resumes cleanly after app backgrounding.
  - Returns `Media` (`id`, thumb/display URLs, w/h, alt).
  - AC: unit tests with a mocked network for each failure; a 6 MB phone photo ends up ≤ limit automatically; a rejected file shows the server's reason.
  - **Status:** ✅ Done
  - **Business overview:** Teachers can add pictures: pick or photograph → shrink/convert on the phone if needed (iPhone HEIC becomes JPEG) → upload straight to storage with a progress bar → server verifies and prepares it. Failures give plain reasons (too large, not an image, upload limit) and can be retried or cancelled.
  - **How to test:** Add an image to a question from gallery and camera; try a huge photo and a PDF.
  - **Notes / bugs / deviations:** `src/media/{plan,upload,useMediaUpload}.ts` + `src/api/media.ts`. Decision logic unit-tested (11 tests). Real upload to R2 with the signed URL untested (needs real storage).

- [x] **FE-1.12 · `MediaPicker` sheet** — `M` · blocked by: FE-1.11
  - Camera / Photo library / Files; permission-denied states with a deep link to Settings; multi-select (for bulk); optional crop (P1); alt-text prompt after selection; "My media" tab (BE-1.7) to reuse existing assets.
  - AC: works on Android 13+ photo picker and iOS limited-library mode.
  - **Status:** ✅ Done
  - **Business overview:** A simple "Add an image" sheet (photos / camera) with a clear message and *Open settings* link if the teacher denied permission.
  - **How to test:** Deny camera permission, then try to take a photo.
  - **Notes / bugs / deviations:** Built into `RichField`, not a standalone component.

- [~] **FE-1.13 · Math integration (after FE-1.1)** — `L` · blocked by: FE-1.1
  - `MathView` per the decision; global render cache keyed by hash; graceful fallback to the raw `$…$` text on failure; text alternative for screen readers; prefetch-render on test start.
  - AC: 30-formula test meets the FE-1.1 budgets on the low-end Android device.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Formulas written as `$…$` currently show as readable TeX text in a highlighted chip (or scrollable block), with the formula as the screen-reader label; real typeset math is NOT implemented.
  - **How to test:** Write `$x^2 + y^2$` in the editor and view it.
  - **Notes / bugs / deviations:** Blocked on FE-1.1. Recommended interim: teachers upload formulas as images. Feature flag `rich_content.math` exists on the server but the app doesn't use it yet.

- [~] **FE-1.14 · Renderer accessibility pass** — `M` · blocked by: FE-1.7, FE-1.8
  - TalkBack/VoiceOver reading order (stem → images alt → options), 200 % font scale, contrast in both themes, reduced motion.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Images announce their description, options announce letter + text + state, timers announce at 5 min and 1 min, tap targets are ≥44 px.
  - **How to test:** Run TalkBack/VoiceOver per QA script §1.
  - **Notes / bugs / deviations:** Labels added everywhere new; **not tested with a real screen reader**. 200% font scale not tested.

- [ ] **FE-1.15 · Performance budget & profiling** — `S` · blocked by: FE-1.7
  - Budget: Next/Prev on a question with 4 image options < 100 ms to interactive from cache; memory stable across a 90-question session; no list re-render storms in the palette.
  - **Status:** ⏭️ Not done
  - **Business overview:** NOT done. No profiling was possible without a device.
  - **How to test:** n/a
  - **Notes / bugs / deviations:** Do during QA: a 90-question test with images on a low-end Android.

---

### M1b — Teacher authoring flow (dedicated; teachers are the only source of questions)

> Replaces the one-question-at-a-time text-only flow (`question-builder.tsx` + `csv-upload.tsx`) with a proper authoring workspace. Old entry points keep working and redirect into the new screens.

- [~] **FE-2.1 · Information architecture & navigation** — `M` · blocked by: none
  - Entry: Teacher **Content** tab → segmented `Tests | Questions`; plus Home tile. New **root-level** teacher routes (see §2) registered in `(teacher)/_layout.tsx`. `question-builder` (deep-linked from `create-test`) redirects to the new editor with `testId` context.
  - AC: back-navigation works from every entry (lesson from admin nav in `P0-Todos.md`); no duplicate entry points.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Teachers reach the new tools from Home: **Question Bank**, **Reports**, **Corrections** (next to New Test/Video/Brain Hack). Editing a question opens a dedicated editor; a test's question list is an overview screen instead of one long form.
  - **How to test:** Teacher Home → tiles; Create Test → question list → Add question.
  - **Notes / bugs / deviations:** No new bottom tab was added (kept the existing 4-tab layout).

- [x] **FE-2.2 · Teacher question API client** — `S` · blocked by: BE-1.13 (types can start now) · files: `src/api/teacherQuestions.ts`
  - list, get, create/update (rich + metadata + tags), delete, bulk-update, check-duplicate, completeness, csv-template, import (validate/commit/update), media, reports, corrections.
  - **Status:** ✅ Done
  - **Business overview:** API client for the question bank, duplicate check, completeness, bulk edit, corrections, topics and tags.
  - **How to test:** Type-checked against the backend contracts; used by the screens below.
  - **Notes / bugs / deviations:** `src/api/questionBank.ts`, `moderation.ts`, `media.ts`.

- [x] **FE-2.3 · Question Bank list** — `L` · blocked by: BE-1.13, FE-1.9 · files: `questions/index.tsx`
  - Infinite list (cursor), debounced search, filter sheet (course/subject/chapter/difficulty/tag/eligible/reported/**missing-metadata**), sort, multi-select mode. Row: `plainText` preview (2 lines) + image badge, metadata pills (difficulty, chapter), status/report badges, parent test.
  - Own content only unless `can_manage_all_content` (toggle "All teachers' content" shown only then).
  - AC: 5 000-question list scrolls at 60 fps; loading/error/empty/no-results states; pull-to-refresh.
  - **Status:** ✅ Done
  - **Business overview:** Teachers can browse every question they own across all tests, search text, filter by difficulty, "no difficulty / chapter / topic / tags / image without description", and "reported"; each row shows the test, image count, report count and what's missing.
  - **How to test:** Teacher Home → Question Bank.
  - **Notes / bugs / deviations:** `(teacher)/question-bank.tsx`, paged (25).

- [x] **FE-2.4 · Rich question editor** — `XL` · blocked by: FE-1.3, FE-1.6, FE-1.11, BE-1.13 · files: `questions/new.tsx`, `questions/[id].tsx`, `src/rich/editor/*`
  - **Source editor + live preview**, not WYSIWYG (RN `TextInput` cannot embed images — decision recorded here). Per-field editors for **stem, options A–D, explanation**, each with a toolbar: **B / I / x₂ / x² / list / image / math**; toolbar wraps/toggles the selection in the markup; images insert `![alt](media:id)` and appear in an **attachment strip** with thumbnails.
  - **Preview tab uses the exact student renderer** (`RichContent` + `OptionCard`), theme toggle for light/dark, "small phone" width toggle (FE-2.16 reuses this).
  - Correct-option picker; metadata panel (FE-2.5); validation checklist (stem present, all options present, key chosen, alt text on stem images, metadata complete for the test type); **Save**, **Save & next**, **Duplicate**; edit-in-place for draft/rejected tests.
  - Keyboard-safe; two-pane (editor | preview) on tablets/large screens (D22, `react-native-web`-friendly layout).
  - AC: author can build a question with an image stem, two image options and a text+image explanation in < 2 min; saving is blocked while uploads are in flight; server validation errors (`invalid_media_ref`, length caps) map to the offending field.
  - **Status:** ✅ Done
  - **Business overview:** A proper question editor: rich stem, four options (each text and/or image), correct answer, explanation, formatting toolbar, live preview and a "student view". Validation shows next to each field before saving.
  - **How to test:** Teacher → test → Add question.
  - **Notes / bugs / deviations:** `(teacher)/question-editor.tsx` + `RichField`. The cursor-position handling (`selection` prop) is the part most likely to need device tuning.

- [x] **FE-2.5 · Metadata pickers** — `M` · blocked by: BE-1.10, BE-1.11
  - Chapter picker (course → subject → chapter tree from `getCurriculum`), topic, **difficulty** segmented, **tags** (autocomplete `GET /tags`, chips, alias-aware), NCERT class + page, source type + year, `custom_eligible` toggle.
  - **Author productivity:** sticky defaults ("apply to next questions") so a batch of 30 questions from one chapter isn't 30 × re-tagging; defaults inherited from the parent test's chapter.
  - **Status:** ✅ Done
  - **Business overview:** Classification fields: subject, chapter, topic (follows chapter), difficulty, NCERT class/page, source (Q Bank / PYQ …), year, label, tags (autocomplete from existing tags), and "available for custom tests".
  - **How to test:** Open Classification in the editor.
  - **Notes / bugs / deviations:** `SelectField`, `TagInput` components.

- [x] **FE-2.6 · Image field UX** — `M` · blocked by: FE-1.11, FE-1.12
  - Per-field attach button, thumbnail with replace / remove / **alt-text sheet**, inline upload progress + retry, size guidance ("max 5 MB · we'll resize"), clear message when rejected (SVG, corrupt, too large).
  - **Status:** ✅ Done
  - **Business overview:** Images are added inside any field, each with a progress bar, retry/cancel, a warning if it has no description, and a small editor for its description (screen-reader text).
  - **How to test:** Add an image; leave description empty → warning chip.
  - **Notes / bugs / deviations:** Max images per question/field come from server limits.

- [x] **FE-2.7 · Duplicate warning UI** — `M` · blocked by: BE-1.12
  - On save response `warnings[]` → bottom sheet comparing the new question with the existing one(s) rendered via `RichContent`; actions **Save anyway / Open existing / Cancel**. Import preflight shows the same warnings per row.
  - **Status:** ✅ Done
  - **Business overview:** While typing, the app quietly checks whether the same question already exists and shows a non-blocking warning with the existing text.
  - **How to test:** Type an existing question word for word.
  - **Notes / bugs / deviations:** Failure of the check never blocks saving.

- [x] **FE-2.8 · Draft safety** — `M` · blocked by: none · files: `src/storage/drafts.ts`
  - Local autosave of the editor state to the file system (no `AsyncStorage` dependency today; `expo-secure-store` is size-limited — use `expo-file-system` JSON), debounce 1 s; `usePreventRemove` unsaved-changes guard; "Restore draft?" prompt after a crash/kill.
  - AC: kill the app mid-edit → draft restored with attachments intact (media ids persisted).
  - **Status:** ✅ Done
  - **Business overview:** If a teacher is interrupted (call, crash), their half-written question is restored next time; leaving the editor asks whether to keep or discard the draft.
  - **How to test:** Type, kill the app, reopen the editor → *Restore* banner.
  - **Notes / bugs / deviations:** AsyncStorage per test+question, 14-day expiry.

- [x] **FE-2.9 · Import v2 (CSV + ZIP, preflight, update mode)** — `XL` · blocked by: BE-1.17–1.20 · files: `questions/import.tsx` (replaces `csv-upload.tsx`), extends `csv-import-report.tsx`
  - Steps: (1) **Template** from `GET /teacher/csv-template` (no more hard-coded `COLUMNS`); share via `expo-sharing`. (2) Pick **CSV** and optionally a **ZIP bundle** (`questions.csv` + `images/`). (3) Upload (presign via `purpose=csv` / `import_bundle`, with progress). (4) **Preflight** → summary (rows OK / warnings / errors) + grouped row errors by `code` (missing image list, bad enum, unknown chapter, possible duplicates). (5) **Commit** → progress polling → final report. (6) **Update mode** toggle (metadata backfill by id/hash) with an explicit warning that text won't change.
  - Downloadable error CSV (`expo-sharing`); large-file resume/cancel; v1 template still supported.
  - AC: 500-question ZIP with 300 images validates, shows exact missing filenames, and commits; killing the app mid-poll resumes on return (fixes the "0 of 0 succeeded" class of bug noted in `P0-Todos.md`).
  - **Status:** ✅ Done
  - **Business overview:** Bulk import v2: download a server-driven template, choose a CSV and optionally a ZIP of images, **check** the file first (errors, warnings, missing images — nothing saved), then **import** the valid rows. An update mode fixes metadata (and optionally wording) by `question_id`.
  - **How to test:** Teacher → test → Import CSV.
  - **Notes / bugs / deviations:** Also fixed: the old report's *Done* button opened **Create Test**, *Fix & Retry* opened the builder with no test, *Download Template* did nothing. Real R2 upload not exercised.

- [~] **FE-2.10 · Completeness dashboard + quick-tag queue** — `L` · blocked by: BE-1.15
  - Per-chapter counts of questions missing difficulty/topic/tags/NCERT/alt text; "Fix" opens a **card-stack tagger**: one question (via `RichContent`), one-tap difficulty, chapter/tag chips, swipe to next, undo, progress bar. Built for speed — this is how the *existing* untagged pool gets backfilled.
  - AC: tag 50 questions in < 5 minutes; optimistic saves with retry.
  - **Status:** ⚠️ Partly done
  - **Business overview:** A "needs attention" strip shows how many questions lack difficulty, tags or image descriptions and jumps into a filtered list; bulk edit then fixes many at once.
  - **How to test:** Question Bank with untagged questions.
  - **Notes / bugs / deviations:** No separate per-chapter completeness dashboard or one-question-at-a-time quick-tag swiper was built; bulk edit covers the use case.

- [x] **FE-2.11 · Bulk actions** — `M` · blocked by: BE-1.14, FE-2.3
  - Selection bar → sheet: set chapter / difficulty / add-remove tags / toggle eligibility / move to test / delete (drafts). Shows per-item result summary; mixed-ownership errors explained.
  - **Status:** ✅ Done
  - **Business overview:** Long-press to select up to 200 questions and set difficulty, chapter, add/remove tags or the custom-test flag in one step (all-or-nothing on the server).
  - **How to test:** Question Bank → long-press → Edit N.

- [x] **FE-2.12 · Publish gate UI** — `M` · blocked by: BE-1.16
  - `submit-for-review` `422 incomplete_questions` → "Fix N questions" list; tap opens the editor filtered/scrolled to the offending field; success path unchanged. Files: `content-preview.tsx` (submit action), `create-test.tsx`.
  - **Status:** ✅ Done
  - **Business overview:** Submitting a test for review checks it first; if questions lack chapter/difficulty or an image isn't ready, the list highlights exactly which questions and what they need.
  - **How to test:** Submit a draft with an unclassified question.
  - **Notes / bugs / deviations:** Test Series tests are exempt from the classification rule (server rule).

- [x] **FE-2.13 · Corrections on published questions** — `L` · blocked by: BE-2.5
  - Opening a *live* question shows "Live — edits need review". Editor enters **correction mode**: reason required, before/after diff, "re-score past attempts" checkbox (only offered when the key changes), submit → "My corrections" list with status. Admin/manage-all sees "Applied".
  - AC: fixes the dead-end where `UpdateQuestion` returns 409 on published tests (A26).
  - **Status:** ✅ Done
  - **Business overview:** Editing a live question's wording/options/answer asks for a reason and sends it for admin review (students keep the current version); tag/classification-only changes save immediately. Teachers can follow their corrections' status.
  - **How to test:** Edit a published question; Teacher Home → Corrections.
  - **Notes / bugs / deviations:** `rescore` (re-score past attempts) flag is supported by the API client but not exposed in the UI.

- [x] **FE-2.14 · Teacher reports inbox** — `M` · blocked by: BE-2.4, FE-2.13
  - List of reports on my questions (filter open/resolved/reason), detail with the question rendered, "Open in editor", resolve with note (`fixed / no change`).
  - **Status:** ✅ Done
  - **Business overview:** Teachers see reports on their own questions (with the question shown), and resolve them as fixed / no change / dismissed with a note that is sent to the student.
  - **How to test:** Teacher Home → Reports.
  - **Notes / bugs / deviations:** Shared `ReportsInbox` with the admin queue.

- [ ] **FE-2.15 · Inventory hints** — `S` · blocked by: BE-4.9
  - Teacher Home card "Chapters low on questions" with a deep link to *new question* pre-filled with that chapter.
  - **Status:** ⏭️ Not done
  - **Business overview:** Inventory hints ("Chapter X has only 6 questions") were not built. The backend endpoint `/teacher/inventory` and admin pool-health exist.
  - **How to test:** n/a
  - **Notes / bugs / deviations:** Add a card to Question Bank using `getInventory`.

- [~] **FE-2.16 · Preview-as-student** — `M` · blocked by: FE-1.7
  - Preview a whole draft test through the **real runtime components** in a no-attempt "preview" mode (no timer, no saving), light/dark + small-screen toggles. Replaces the bespoke read-only rendering in `content-preview.tsx`.
  - **Status:** ⚠️ Partly done
  - **Business overview:** "Student view" toggle in the editor and the preview screens show the question as students will see it.
  - **How to test:** Editor → Student view.
  - **Notes / bugs / deviations:** Uses the shared preview card, not the real test runtime component; a full 'run this as a student' dry run was not built.

- [ ] **FE-2.17 · Author help** — `S`
  - In-editor "Formatting guide" (sub/sup, images, math), image guidelines (size, contrast, alt text), tooltips on toolbar buttons.
  - **Status:** ⏭️ Not done
  - **Business overview:** In-app author help/guidelines were not written.
  - **How to test:** n/a
  - **Notes / bugs / deviations:** Content task — needs copy from the team.

- [ ] **FE-2.18 · Question stats (P2)** — `M` · blocked by: BE-4.7
  - Per-question attempts, accuracy, avg time, report count, outlier flag in the editor/list.
  - **Status:** ⏭️ Not done
  - **Business overview:** Per-question stats (attempts, % correct, option distribution) for teachers were not built (API client `getQuestionStats` exists).
  - **How to test:** n/a
  - **Notes / bugs / deviations:** P2.

- [~] **FE-2.19 · Role UX** — `S` · manage-all teacher toggle, admin sees everything; consistent "not your content" empty states.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Access rules are enforced by the server (teachers only their own; admins/"manage all" teachers everything) and the screens respect the resulting empty states.
  - **How to test:** Log in as an ordinary teacher and as an admin.
  - **Notes / bugs / deviations:** No UI toggle for 'manage-all'.

- [x] **FE-2.20 · Teacher `create-test` cleanup for the new model** — `S` · blocked by: FE-0.3
  - `teacherCreatable` from the registry (teachers never see `custom`); after create, land in the new editor; remove the temporary mock states (see FE-0.8).
  - **Status:** ✅ Done
  - **Business overview:** Create Test now sends the duration, marking, subscription choice and the right course/subject; module choices come from the registry.
  - **How to test:** Create a timed test with +4/-1 and open it as a student.
  - **Notes / bugs / deviations:** **Real bug fixed:** duration, marks and topic were collected but never sent, so every test was untimed with default marks; course was always the first in the list; a dead mock 'rejected edit' branch removed; the fake 'Topic' input removed. The location picker now passes course/subject.

---

### M2 — Bookmarks, Reports, Ratings, admin queues

- [x] **FE-3.1 · Bookmarks store + API** — `M` · blocked by: BE-2.2 · files: `src/features/bookmarks/`
  - Context/store loading `GET /me/bookmarks/ids` after login (compact id sets per item type), **optimistic toggle** with rollback on failure, offline-tolerant queue, cleared on logout. Polymorphic (`question|flashcard|content`) from day one.
  - AC: toggle reflects instantly everywhere the same question is on screen; failure reverts with a toast.
  - **Status:** ✅ Done
  - **Business overview:** A bookmark icon appears instantly and correctly everywhere (test, review, lists) because the app keeps the set of bookmarked questions in memory and updates it optimistically, rolling back if the server refuses.
  - **How to test:** Bookmark in a test, then see it in review and in Bookmarks.
  - **Notes / bugs / deviations:** `BookmarksProvider`.

- [~] **FE-3.2 · `BookmarkButton` + collection chooser** — `M` · blocked by: FE-3.1
  - Placed in: runtime question header, review card, tutor reveal, (later) flashcards. Tap toggles into the **last-used collection**; long-press / "▾" opens the collection sheet. Labels come from `app-config` (**⚑ D19** — placeholder names until confirmed). Disabled with an explanatory tooltip if the question wasn't exposed.
  - AC: one tap to bookmark, one tap to remove; screen-reader announces state.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Bookmark button on the test screen and review; tapping saves to the default list.
  - **How to test:** Tap the bookmark.
  - **Notes / bugs / deviations:** **No collection chooser sheet** — bookmarks go to the first list; students can *Move* them later on the Bookmarks screen.

- [x] **FE-3.3 · My Bookmarks screen** — `L` · blocked by: FE-3.2, BE-2.2 · files: `(student)/(profile)/bookmarks.tsx`
  - Entry from Profile; collection tabs, subject/chapter filter, search, list (stem via `RichContent`; answer + explanation only when the API returns them), remove, open in context, **"Practise these"** CTA → custom builder pre-filled (status=Bookmarked, collection) — FE-5.1 completes the round trip.
  - AC: empty state per tab; large lists paginate.
  - **Status:** ✅ Done
  - **Business overview:** Profile → Bookmarks: lists (as named by admin), search, saved questions with images, move between lists, remove, and "Practise my bookmarks" which opens the builder pre-filled.
  - **How to test:** Profile → Bookmarks.

- [x] **FE-3.4 · Report sheet** — `M` · blocked by: BE-2.4 · files: `src/features/reports/`
  - Bottom sheet with the reasons list **from `app-config`** (*Wrong answer marked · Typo/unclear · Duplicate · Outdated · Image missing/unreadable · Other*), optional ≤ 300-char note, submit → success state ("Thanks — sent to the author"), **already-reported** state, error state. Entry: runtime overflow, tutor reveal, review card.
  - `Idempotency-Key` on submit; can't be spammed (button disabled while sending).
  - AC: works mid-test without interrupting the timer/autosave; reason list changes without an app release.
  - **Status:** ✅ Done
  - **Business overview:** "Report a problem" sheet on the test screen and in review with admin-controlled reasons, an optional note, and friendly handling if already reported.
  - **How to test:** Flag icon on a question.

- [x] **FE-3.5 · My reports** — `S` · blocked by: BE-2.4 — Profile → small list showing status ("Fixed ✓ / Reviewed / Open").
  - **Status:** ✅ Done
  - **Business overview:** Profile → My reports shows each report and its outcome (Under review / Fixed / No change) with the teacher's note.
  - **How to test:** Profile → My reports.

- [x] **FE-3.6 · Rating components** — `M` · blocked by: BE-2.6
  - `StarRating` (input + display, half-star display for averages) and `ThumbsFeedback`; **⚑ D20**: stars on tests/videos/documents, thumbs on question explanations. Placement: **result screen** ("Rate this test"), test list rows (avg · count), video-player end, review explanation.
  - Eligibility errors (`not_eligible`) show a friendly hint ("Finish the test to rate it").
  - AC: rating twice updates; no free-text anywhere.
  - **Status:** ✅ Done
  - **Business overview:** Star rating for tests (after finishing) and Brain Hacks; thumbs up/down on an explanation in review. Rating again changes it; tapping the same value removes it; "finish it first" message if not eligible.
  - **How to test:** Result screen → rate; Review → thumbs.
  - **Notes / bugs / deviations:** Video/document/flashcard-deck rating UI not added (API supports it).

- [ ] **FE-3.7 · Sort/filter by rating** — `S` · blocked by: BE-2.6 · files: `(practice)/hierarchy.tsx`
  - "Top rated" chip → `sort=rating`; rows show `★ 4.6 (128)` when `rating_count ≥ 5`.
  - **Status:** ⏭️ Not done
  - **Business overview:** Sorting/filtering lists by rating was not added to the Practice browse screens; Brain Hacks show the average once enough ratings exist.
  - **How to test:** n/a
  - **Notes / bugs / deviations:** Add `sort=rating` to `listTests`/hierarchy.

- [x] **FE-3.8 · Admin: Reports queue + Corrections approval** — `L` · blocked by: BE-2.4, BE-2.5 · files: `(admin)/(review)/reports.tsx`, `report-detail.tsx`, `corrections.tsx`; register in `(admin)/(review)/_layout.tsx`; add a third card to the Approvals hub (`(admin)/(review)/index.tsx` already has `ApprovalNavCard`s and a combined pending count)
  - Reports: filters (status/reason/course), detail with the question rendered (images!), reporter count, actions **fixed / no change / dismiss / reassign**. Corrections: before/after diff, approve/reject, "re-score" indicator.
  - AC: pending counts feed the hub badge.
  - **Status:** ✅ Done
  - **Business overview:** Admins have a Question Reports queue and a Corrections queue with a side-by-side *Now vs Proposed* diff (images visible), approve / reject-with-reason.
  - **How to test:** Admin → Approvals → Question Reports / Corrections.
  - **Notes / bugs / deviations:** Report *reassign* to another teacher is not in the UI.

- [x] **FE-3.9 · Admin: bookmark-collection config** — `S` · blocked by: BE-2.3 — names/order/active.
  - **Status:** ✅ Done
  - **Business overview:** Admins can rename, enable/disable the bookmark lists.
  - **How to test:** Admin → Custom Tests & Pool → Bookmark lists.
  - **Notes / bugs / deviations:** Reordering not in UI.

- [ ] **FE-3.10 · Teacher rating visibility (P2)** — `S` — rating + count on the teacher's content cards.
  - **Status:** ⏭️ Not done
  - **Business overview:** Teachers don't yet see rating averages on their content cards.
  - **How to test:** n/a
  - **Notes / bugs / deviations:** P2.

---

### M3 — Custom Test MVP (student)

> Custom tests enter the **same** attempt pipeline. Do FE-4.14 (runtime extraction) *before* touching runtime behaviour.

- [x] **FE-4.1 · API client + types** — `M` · blocked by: BE-3.4 (types can start now) · files: `src/api/customTests.ts`
  - `getBuilderConfig`, `countBlueprint(signal)`, `generateCustomTest(blueprint, idempotencyKey)`, `listCustomTests`, `getCustomTest`, `renameCustomTest`, `deleteCustomTest`, `regenerate`, `fromAttempt`, templates. Blueprint types mirror `contracts/blueprint-v1/` with runtime validation (zod-less guards to avoid a new dep, or add `zod` if preferred).
  - **Status:** ✅ Done
  - **Business overview:** Typed client for builder config, live count, generate (with idempotency key), my tests, rename/delete, new set, practise-my-mistakes, templates, sharing.
  - **How to test:** Used by every custom-test screen.
  - **Notes / bugs / deviations:** `src/api/customTests.ts`.

- [x] **FE-4.2 · Blueprint state** — `M` · blocked by: FE-4.1 · files: `src/features/custom-test/blueprint/`
  - Reducer + context; derived validity from `builder-config` limits; serialisation to the API; **unsent-draft persistence** (survives backgrounding); reset; "personal defaults" (last-used mode/duration/marking — CM-P5).
  - AC: reducer unit tests (select/deselect chapters, count clamping, mode/timing interplay).
  - **Status:** ✅ Done
  - **Business overview:** The rules of a custom test (filters, count, mix, mode, timing, marking) are checked on the phone with the exact same rules as the server — proven by the 20 shared golden vectors — so errors show instantly, and server "suggestion" patches can be applied safely.
  - **How to test:** `npx jest src/custom` (33 tests).
  - **Notes / bugs / deviations:** `src/custom/blueprint.ts`, `useBuilder.ts`.

- [x] **FE-4.3 · Builder shell screen** — `L` · blocked by: BE-3.10, FE-4.2 · files: `(practice)/custom-builder.tsx`
  - **Server-driven**: renders sections from `builder-config` via a small **widget catalogue** (`tree`, `multiselect`, `range`, `stepper`, `segmented`, `toggle`, `tags`) so a new filter needs a server change only (CM-E2/E3). Sticky bottom summary bar (`20Q · 20 min · Exam · Start`). Keyboard-safe; one-handed reach; hidden entirely if `custom_test.enabled` is off; **preview-mode users** (`app/preview-mode.tsx`) see it read-only with Start routed to sign-in.
  - Loading skeleton, error + retry, "course not supported" empty state.
  - **Status:** ✅ Done
  - **Business overview:** The Custom Test builder screen: one scrolling page of clear cards with a sticky footer showing how many questions match and the Generate button.
  - **How to test:** Practice → Custom Test.
  - **Notes / bugs / deviations:** `(practice)/custom-builder.tsx`. Not visually verified.

- [x] **FE-4.4 · Subject / chapter / topic tree picker** — `L` · blocked by: BE-3.10
  - Tri-state checkboxes, per-node **eligible-question counts** (reflecting current filters), search, expand/collapse, select-all/clear, virtualised (`FlatList`/`SectionList`; 200+ chapters). Course-driven — **no hard-coded subject names** (CM-E11).
  - **Status:** ✅ Done
  - **Business overview:** Pick subjects, chapters and topics from a tree that shows how many questions each has; empty ones are disabled; choosing a whole subject makes its chapters implicit.
  - **How to test:** Builder → Scope.
  - **Notes / bugs / deviations:** `ScopeTree`.

- [x] **FE-4.5 · Count & config controls** — `M`
  - Question-count stepper + numeric input + chips (10/20/30/50/90) clamped to server limits; difficulty chips; **timing** (timed/untimed; suggested duration = count × pace, editable within allowed range); **marking** presets (NEET +4/−1, no-negative, custom with bounds) and a negative-marking toggle; **mode** segmented (Exam / Tutor — Tutor only when `custom_test.tutor_mode`).
  - **Status:** ✅ Done
  - **Business overview:** Number of questions (stepper + quick picks 10/20/30/50/90), Exam/Tutor mode, untimed/timed with suggested duration, marking presets (NEET, no negative, custom), difficulty and mix.
  - **How to test:** Builder cards.

- [x] **FE-4.6 · Live availability & shortfall UX** — `M` · blocked by: BE-3.7
  - Debounced (300 ms) `count` calls with **cancellation** (`AbortController`); states: counting (skeleton), "N questions match", **shortfall explainer** built from the server's `bottleneck` + `suggestions` (buttons apply the suggested blueprint patch: *Use 4 · Include Medium · Include attempted*). Start disabled at 0. **Never a blank error** (journey J3 in the spec).
  - AC: rapid taps don't produce out-of-order results; offline shows a clear state.
  - **Status:** ✅ Done
  - **Business overview:** Live "N questions match" that updates ~½ s after each change (cancels stale requests, cached, rate-limit aware). When there aren't enough, it names the tightest filter and offers one-tap fixes that are each proven to add questions.
  - **How to test:** Choose Hard + a small chapter + 90 questions.

- [~] **FE-4.7 · Presets, recents & quick-start** — `M` · blocked by: BE-3.11
  - Preset chips from `builder-config` (Daily 20, Chapter sprint, PYQ only, NEET 45 min…) and "Repeat last test" (from `listCustomTests`). Tap = prefill; long-press/secondary = one-tap generate. Aim: Home → running test in ≤ 4 taps.
  - **Status:** ⚠️ Partly done
  - **Business overview:** "Start from" row with admin presets and your saved templates.
  - **How to test:** Builder → Start from.
  - **Notes / bugs / deviations:** No 'recent setups' shortcut.

- [x] **FE-4.8 · Generate flow** — `M` · blocked by: BE-3.8, FE-4.6
  - Start → `generateCustomTest` (idempotency key per attempt of the user action) → if `relaxations[]` non-empty show a concise sheet ("Only 14 Hard matched; added 6 Medium") before **pre-start**. Error handling by `code`: `pool_too_small` (same suggestions UI), `quota_exceeded` (resets_at shown), `not_entitled` (upsell, FE-4.9), `invalid_blueprint` (should not happen; log).
  - AC: double-tap Start creates exactly one test; retry after a network drop returns the same test.
  - **Status:** ✅ Done
  - **Business overview:** Generate builds a private test in one tap (safe against double-taps and dropped responses). If the server had to adjust something (e.g. fewer questions) it says so before you start; friendly messages for too few questions, daily limit, rate limit and too many saved tests.
  - **How to test:** Generate normally and with too-narrow filters.

- [x] **FE-4.9 · Free-tier & entitlement UX** — `M` · blocked by: BE-3.6
  - Full builder visible; clamp + explainer ("Free plan: up to 10 questions from free chapters · 2 of 3 tests left today"); upgrade sheet reusing the locked-item sheet from `hierarchy.tsx` → `subscription-plans`. Expired subscription: can finish in-progress, can't generate.
  - **Status:** ✅ Done
  - **Business overview:** Free students see how many custom tests they have left today and the max size; the count control can't exceed it; hitting the limit shows when it resets plus an upgrade path.
  - **How to test:** Use a free account.

- [x] **FE-4.10 · Practice hub changes** — `M` · blocked by: FE-0.3, FE-4.7
  - 4th "Custom" card from the registry; **Continue** row for an in-progress attempt showing *server-derived* time left; entry to "My custom tests". Keep the three existing cards unchanged.
  - **Status:** ✅ Done
  - **Business overview:** The Practice hub is driven by the registry; Custom shows only when enabled; Flashcards entry and a Continue card for an in-progress test were added.
  - **How to test:** Practice tab.

- [x] **FE-4.11 · My custom tests + Templates** — `L` · blocked by: BE-3.9 · files: `(practice)/custom-tests.tsx`
  - Tabs: **Tests** (state, last score, blueprint summary, filters by subject/date/state; rename, delete via swipe/menu, "New set" = regenerate) and **Templates** (BE-4.12, FE-5.3). Empty states with a CTA.
  - **Status:** ✅ Done
  - **Business overview:** My custom tests (state filters, resume, retake, New set, rename, delete that keeps scores) and Templates.
  - **How to test:** Practice → Custom → menu → My custom tests.
  - **Notes / bugs / deviations:** `(practice)/custom-tests.tsx`.

- [~] **FE-4.12 · Entry points** — `S` · blocked by: FE-4.3
  - Student Home quick-link tile (notes §B.1), Practice hub, Profile → My tests, post-result CTAs. Home carousel (E.1) handled in FE-6.1.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Entry points: Practice hub, builder menu, result screen ("Practise my mistakes"), Bookmarks ("Practise my bookmarks"), Progress (recommendations, weak areas), share links.
  - **How to test:** Each entry.
  - **Notes / bugs / deviations:** Not added to Home quick-access or Explore.

- [x] **FE-4.13 · Pre-start v2** — `M` · blocked by: BE-3.12 · files: `test-pre-start.tsx`
  - Instructions **generated from the resolved config** (mode, timing, marking, count actually generated vs requested) replacing the static `INSTRUCTIONS_TIMED/UNTIMED`; resume detection (FE-0.8); image prefetch progress (FE-1.10).
  - **Status:** ✅ Done
  - **Business overview:** Pre-start now shows real marking (no more "--1"), Resume with real progress ("answered 7 of 20"), tutor mode note, and what a custom test was built from.
  - **How to test:** Open a partly-done test.
  - **Notes / bugs / deviations:** Backend `active_attempt` added to `GET /tests/:id`.

- [x] **FE-4.14 · Runtime refactor (structure first)** — `L` · blocked by: none for the pure split; BE-0.5 for server time · files: `test-question.tsx` (588 lines)
  - Extract hooks: **`useAttemptSession`** (start/resume, questions, answers map), **`useAttemptTimer`** (derive countdown from server `expires_at` + `server_now` skew; on 0 → **auto-submit** and navigate to result, handling `409 attempt_expired`; today it only navigates to `test-submit-confirm`), **`useAnswerSync`** (per-tap save → retry queue → batch flush; "unsynced" indicator; **submit blocks until flushed**), and a `QuestionPalette` component with states *answered / unanswered / marked / visited-not-answered*.
  - **Phase A (no BE):** pure extraction, zero behaviour change, snapshot + hook tests. **Phase B (needs BE-0.5/4.2):** server-time + batch sync.
  - AC: existing Q Bank/Test Series/Practice attempts behave identically (manual regression checklist FE-4.24); a killed app during a timed test never leaves it open past the deadline.
  - **Status:** ✅ Done
  - **Business overview:** The live test screen was rebuilt: answers keyed by question (palette bug fixed), server-corrected timer, background-safe countdown, offline answer queue with retry and restore after a crash, safe submit, back-button guard, device-lock takeover.
  - **How to test:** QA script §2.
  - **Notes / bugs / deviations:** Hooks: `useAttemptSession`, `useAnswerSync`, `useAttemptTimer`; logic unit-tested (23 tests).

- [x] **FE-4.15 · Mark for review + clear response** — `M` · blocked by: BE-0.4, BE-4.2
  - Toggle on the question header (persisted, survives resume), palette state, "N marked" in `test-submit-confirm`; **clear response** working end-to-end (A8).
  - **Status:** ✅ Done
  - **Business overview:** Mark-for-review flag and "Clear my response"; marking never wipes the answer.
  - **How to test:** Flag a question, check palette.

- [x] **FE-4.16 · Tutor mode** — `M` · blocked by: BE-4.1, FE-1.6, FE-1.8
  - Select → **Lock** → `reveal` → correct option + explanation (`RichContent`, images) → Next. Locked questions are read-only; timer (if any) continues; `answer_locked` handled; bookmark/report available on the reveal card.
  - **Status:** ✅ Done
  - **Business overview:** Tutor mode: choose, *Check answer*, see correct/incorrect and explanation; answer locks.
  - **How to test:** Generate a tutor test (flag on).

- [x] **FE-4.17 · Interruption & multi-device handling** — `M` · blocked by: BE-4.15
  - `AppState` foreground → resync + timer correction; reconnect → flush queue; `attempt_active_elsewhere` → read-only banner with "Continue here" (takeover).
  - **Status:** ✅ Done
  - **Business overview:** If the test is open on another device the app says so and offers *Continue here*; offline changes are retried on reconnect/foreground; deadline passing mid-test lands on the result.
  - **How to test:** QA script §2.

- [~] **FE-4.18 · Result v2 (widget registry)** — `L` · blocked by: BE-3.13, BE-4.3 · files: `test-result.tsx`
  - Result = ordered widgets chosen by module/mode config (CM-E8): `summary`, `subject-breakdown`, `chapter-breakdown`, `difficulty-breakdown` (P1), `time` (M4), `actions`. Actions: **Review**, **Practise my mistakes**, **Retake** (same questions) vs **New set** (regenerate) — labels from the registry's `canRetake` semantics, **Rate this test**.
  - Show accuracy as *correct ÷ attempted* with attempted/total beside it (D9).
  - **Status:** ⚠️ Partly done
  - **Business overview:** Result: score ring (never negative), correct/wrong/skipped, time taken, focus-area callout, breakdown bars by subject/chapter/difficulty (hidden if no data), rating, Review, Practise my mistakes, Retake.
  - **How to test:** Finish a test.
  - **Notes / bugs / deviations:** Widgets are inline, not a plug-in registry; time-analysis widget not built.

- [x] **FE-4.19 · Review v2** — `L` · blocked by: BE-3.14, FE-1.8 · files: `test-review.tsx`
  - Filter chips **All / Correct / Wrong / Unattempted / Marked / Bookmarked** (server-side, cursor); position order; NCERT chip; bookmark / report / thumbs actions; cohort "% got this right" when returned (FE-5.10). Keep the timed Previous/Next + palette bottom-sheet behaviour that just shipped.
  - **Status:** ✅ Done
  - **Business overview:** Review: server-side filters (All/Incorrect/Correct/Unattempted/Marked/Bookmarked), paging, palette, images, cohort % right, time spent, notes, thumbs, bookmark, report.
  - **How to test:** QA script §3.
  - **Notes / bugs / deviations:** Removed a fake 10-minute 'review timer'.

- [x] **FE-4.20 · History** — `S` · blocked by: FE-0.3 · files: `test-history.tsx`
  - "Custom" filter via the registry + blueprint summary as subtitle (e.g. "Physics · Optics · 25Q · Tutor").
  - **Status:** ✅ Done
  - **Business overview:** History filters come from the registry and in-progress attempts resume correctly.
  - **How to test:** Tap an in-progress row.
  - **Notes / bugs / deviations:** **Bug fixed:** it used to open with the attempt id where a test id is required.

- [x] **FE-4.21 · Progress detail integration** — `M` · blocked by: BE-3.15 · files: `(profile)/progress-detail.tsx`
  - Custom-test stats segment; subject accuracy now includes cross-subject tests; **no fabricated placeholder subjects** when empty (show an honest empty state).
  - **Status:** ✅ Done
  - **Business overview:** Progress: real trend, syllabus coverage, weak areas with one-tap practice, mastery by subject/chapter, recommendations, streak; each section loads/fails on its own.
  - **How to test:** Profile → Progress.

- [~] **FE-4.22 · Telemetry instrumentation** — `S` · blocked by: FE-0.5
  - Events: `custom.builder_opened`, `custom.filter_changed`, `custom.count_shortfall`, `custom.generated`, `custom.started`, `custom.submitted`, `custom.review_opened`, `custom.practise_mistakes`, `report.submitted`, `bookmark.toggled`, `rating.submitted`, `media.upload_failed`.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Product events fire from builder, generation, submit, review, reports, bookmarks, ratings, uploads, imports, flashcards, notes.
  - **How to test:** Watch console in dev.
  - **Notes / bugs / deviations:** `custom.started` not emitted.

- [~] **FE-4.23 · Accessibility & theming pass** — `M` — builder tree, palette states, tutor reveal, result widgets; light/dark; 200 % font; reduced motion (`Stagger` animations).
  - **Status:** ⚠️ Partly done
  - **Business overview:** Accessibility roles/labels/live regions and ≥44px targets across new screens; theme tokens for light/dark incl. new success/warning/danger tints.
  - **How to test:** QA script.
  - **Notes / bugs / deviations:** No screen-reader or 200% font device pass yet.

- [~] **FE-4.24 · QA script & device matrix** — `M`
  - Written manual checklist: iOS + Android, small/large phones + tablet, dark mode, slow 3G, airplane mode mid-test, kill app mid-test, timer expiry while backgrounded, image-heavy 90-question test, legacy plain-text tests (regression), free vs paid vs admin, preview-mode user.
  - **Status:** ⚠️ Partly done
  - **Business overview:** A written QA script and bug log exist: `fe/docs/custom-test-module-qa.md`.
  - **How to test:** Follow it on devices.
  - **Notes / bugs / deviations:** The device matrix has **not** been run.

---

### M4 — "Marrow-class"

- [x] **FE-5.1 · Status filters** — `M` · blocked by: BE-3.3, BE-2.2 — *Unattempted / Incorrect / Correct / Bookmarked* (+ collection picker) with counts; union semantics; "Practise these" from Bookmarks lands here pre-filled. (`custom_test.status_filters` flag.)
  - **Status:** ✅ Done
  - **Business overview:** "Which questions?" — Unattempted / Incorrect / Correct / Bookmarked (with bookmark-list choice), enabled by the admin flag.
  - **How to test:** Builder.

- [~] **FE-5.2 · Advanced sheet** — `L` — difficulty **mix** sliders, **subject weights** (even / proportional / custom), exclusions ("skip last N days"), tag include/exclude, source filter, NCERT range, ordering. All rendered from `builder-config` widgets.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Advanced options: source, skip-recent, NCERT class/pages, tags, strategy, order, subject balance, difficulty mix presets.
  - **How to test:** Builder → Advanced.
  - **Notes / bugs / deviations:** Mix uses 4 presets, not free sliders; custom per-subject weights not in UI.

- [x] **FE-5.3 · Templates** — `M` · blocked by: BE-4.12 — save current blueprint, run/edit/duplicate/delete, "edit & re-run" from any past test.
  - **Status:** ✅ Done
  - **Business overview:** Save the setup as a template, list, load, delete; share a code/link.
  - **How to test:** Builder menu.
  - **Notes / bugs / deviations:** Rename/edit of a template not in UI.

- [~] **FE-5.4 · Mastery map, coverage, weak areas** — `L` · blocked by: BE-4.4 — Progress → *Topic mastery* (heat-map by subject, bucket weak/improving/strong, last practised), coverage bar ("312 / 1,140 seen"), weak-area list with a **Practise** CTA → prefilled builder.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Coverage ring + per-subject bars, mastery by subject/chapter with Strong/Improving/Needs work.
  - **How to test:** Progress.
  - **Notes / bugs / deviations:** List, not a heat-map.

- [~] **FE-5.5 · Recommendations** — `M` · blocked by: BE-4.6 — Home/Explore/Result card, rule-based.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Recommended-for-you cards on Progress open the builder pre-filled.
  - **How to test:** Progress.
  - **Notes / bugs / deviations:** Not on Home/Explore.

- [ ] **FE-5.6 · Time analysis widget** — `M` · blocked by: BE-0.4, BE-4.2 — avg time/question, slowest, per subject.
  - **Status:** ⏭️ Not done
  - **Business overview:** A time-analysis widget was not built; per-question time is shown in review.
  - **How to test:** n/a
  - **Notes / bugs / deviations:** P2.

- [ ] **FE-5.7 · Option strike-through** — `S` — local-only long-press on `OptionCard`.
  - **Status:** ⏭️ Not done
  - **Business overview:** Option strike-through was not built (`OptionCard` supports the 'struck' state).
  - **How to test:** n/a
  - **Notes / bugs / deviations:** Small task.

- [ ] **FE-5.8 · Confidence marking (P2)** — `M` · blocked by: BE-4.2 — sure / unsure / guess; confident-wrong analytics widget.
  - **Status:** ⏭️ Not done
  - **Business overview:** Confidence marking has no picker UI yet; the runtime hook and API support it and review displays it.
  - **How to test:** n/a
  - **Notes / bugs / deviations:** Add three chips under the options.

- [x] **FE-5.9 · Personal question notes (P2)** — `M` · blocked by: BE-4.14 — lightweight `RichEditor` (no toolbar image upload in v1), shown in review/bookmarks.
  - **Status:** ✅ Done
  - **Business overview:** Private notes on any question in review (up to 4000 chars).
  - **How to test:** Review → note icon.

- [x] **FE-5.10 · Cohort "% got this right"** — `S` · blocked by: BE-4.8 — chip on review items; percentile deferred (D8).
  - **Status:** ✅ Done
  - **Business overview:** "N% of students got this right" in review.
  - **How to test:** Review.

- [x] **FE-5.11 · Admin: custom-test settings** — `M` · blocked by: BE-4.10 · `(admin)/(home)/custom-test-settings.tsx` — flags, limits, eligible sources, free-tier caps, report thresholds.
  - **Status:** ✅ Done
  - **Business overview:** Admin console for feature flags and every limit (with defaults, confirm on enabling), plus health metrics.
  - **How to test:** Admin → Custom Tests & Pool.

- [~] **FE-5.12 · Admin: presets manager** — `M` · blocked by: BE-3.11 — CRUD with a preview of the resolved blueprint.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Admin can list, enable/disable and delete presets.
  - **How to test:** Same screen.
  - **Notes / bugs / deviations:** Creating/editing presets is API-only.

- [x] **FE-5.13 · Admin: pool-health dashboard** — `M` · blocked by: BE-4.9 — counts by subject/chapter/difficulty, metadata completeness, low-inventory alerts, reported/under-review; charts follow the analytics-overview reference implementation.
  - **Status:** ✅ Done
  - **Business overview:** Pool health: counts per chapter, warning below the floor.
  - **How to test:** Same screen.

- [ ] **FE-5.14 · Admin: taxonomy manager** — `M` · blocked by: BE-4.11 — topics + tag merge/alias.
  - **Status:** ⏭️ Not done
  - **Business overview:** Topic/tag management screens were not built (API exists).
  - **How to test:** n/a

- [ ] **FE-5.15 · Streak / daily-goal ring (P2)** — `M` — custom tests count toward `day_streak`.
  - **Status:** ⏭️ Not done
  - **Business overview:** Streak/daily-goal ring not built.
  - **How to test:** n/a
  - **Notes / bugs / deviations:** P2.

---

### M5 — Follow-on epics from `notes.md` (separate mini-projects that reuse this platform)

- [x] **FE-6.1 · Home carousel + custom-test tile (E.1)** — `S/M` · blocked by: BE-5.7 (for real data)
  - `(student)/(home)/index.tsx` already has the built carousel, commented out, with a placeholder `UPDATES` array. Un-comment, feed real content (or hide when empty — never placeholder copy), add the Custom Test tile.
  - **Status:** ✅ Done
  - **Business overview:** Home carousel shows real admin-curated updates and disappears when there are none; CTAs only open allowed in-app screens.
  - **How to test:** Add an update via the API.
  - **Notes / bugs / deviations:** Fake copy removed.

- [ ] **FE-6.2 · Explore revamp (A.3)** — `L` · blocked by: BE-5.4 — real discovery across Q Bank, Custom presets, Flashcards; replaces the `EXPLORE` tile row.
  - **Status:** ⏭️ Not done
  - **Business overview:** Explore revamp not built (API `/explore` client exists).
  - **How to test:** n/a

- [~] **FE-6.3 · Flashcards v1 (A.2)** — `XL` (own plan) · blocked by: BE-5.3, FE-1.x, FE-3.1 — reuses `RichContent`, `RichEditor`, bookmarks, spaced repetition; index/navigation by subject/chapter/deck; "quick questions" mode.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Students can browse decks and study with flip + Again/Hard/Good/Easy; quick review; locked decks lead to plans.
  - **How to test:** Practice → Flashcards.
  - **Notes / bugs / deviations:** Teacher/admin deck authoring screens not built.

- [~] **FE-6.4 · Brain Hacks — real (D.2, A27)** — `L` · blocked by: BE-5.1
  - Replace the mocks: `create-brain-hack.tsx` (fake `setTimeout` save, `image` boolean state) → real create/edit with `RichEditor` + cover image via `useMediaUpload`; `brain-hack-detail.tsx` hard-coded `HACKS` → API + `RichContent`; list + home shelf from API; admin approval in the Approvals hub. (Video support later, CM-RC12.)
  - **Status:** ⚠️ Partly done
  - **Business overview:** Brain Hacks are real for students (categories, images, rating) and teachers can write and submit one.
  - **How to test:** Home → See all.
  - **Notes / bugs / deviations:** Admin approval screen for hacks not built (API exists); teacher list of own hacks not built.

- [ ] **FE-6.5 · Wellness screens (CM-FO8)** — `M` · blocked by: BE-5.2 — `wellness-article.tsx` renders hard-coded text; render API `body_text` + media via `RichContent`.
  - **Status:** ⏭️ Not done
  - **Business overview:** Wellness screens still render the old text; rich rendering not wired.
  - **How to test:** n/a
  - **Notes / bugs / deviations:** Use `RichContent` with `/wellness/content/:id`.

- [ ] **FE-6.6 · Video notes with markdown (A.4)** — `L` · blocked by: BE-5.5 — timestamped notes panel next to the (now real) `expo-video` player; reuses `RichEditor`/`RichContent`.
  - **Status:** ⏭️ Not done
  - **Business overview:** Video notes UI not built (API client exists).
  - **How to test:** n/a

- [~] **FE-6.7 · Push notifications v1 (E.2)** — `L` · blocked by: BE-5.6 — permission flow, token registration, replace the "Coming soon" Notifications toggle in Settings, deep links (report resolved, streak, scheduled practice).
  - **Status:** ⚠️ Partly done
  - **Business overview:** Push: permission is asked only when the student turns it on in Settings; token registered/removed; tapping a push opens an allowed screen; streak/report-update switches; notification inbox.
  - **How to test:** QA script §7.
  - **Notes / bugs / deviations:** Needs a dev-client build and a physical device; nothing could be run here.

- [~] **FE-6.8 · Screen-capture protection (C.3)** — `S/M` · blocked by: FE-0.1
  - `expo-screen-capture` `usePreventScreenCaptureAsync` on runtime, review and video **when `auth.user.role === 'student'`**; admin/teacher exempt. **Best-effort** — neither OS fully prevents recording; write that expectation in the ticket. Dev-client rebuild required.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Screenshots/recording blocked on test and review screens for students only.
  - **How to test:** Dev-client build.
  - **Notes / bugs / deviations:** Lazy-loaded so a build without the module doesn't crash; unverified.

- [ ] **FE-6.9 · P3 extras** — `M` · share result card, share blueprint deep link, scheduled practice reminders (needs FE-6.7).
  - **Status:** ⏭️ Not done
  - **Business overview:** Result share card and scheduled reminders not built (share-code deep link is).
  - **How to test:** n/a

- [~] **FE-6.10 · Housekeeping** — `S` · update `notes.md` (§B.1 client-side generation not viable; §D.2 Brain Hacks are mocks; "video doesn't play" is stale); delete `src/mocks/` once unused.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Docs updated: `notes.md` corrected, QA script added, todo docs annotated.
  - **How to test:** Read `fe/notes.md`.
  - **Notes / bugs / deviations:** Legacy files still contain some hard-coded copy.

---

## 4. Cross-cutting checklists

### 4.1 Definition of done (per task)
- [ ] Acceptance criteria met · `tsc` + lint + tests green
- [ ] Loading / error / empty / offline / no-entitlement states implemented
- [ ] Light + dark verified · 200 % font scale · screen-reader pass
- [ ] Behind a flag until QA sign-off · analytics events fired
- [ ] Legacy plain-text content and existing modules regression-checked

### 4.2 Performance budgets
| Interaction | Budget |
|---|---|
| Builder interactive after config load | < 1 s |
| Live count (debounced) | result < 500 ms after last change |
| Next/Prev question with 4 image options (cached) | < 100 ms |
| Test start with prefetch of 60 images on 4G | < 8 s, never blocking question 1 |
| Editor keystroke → preview update | < 50 ms |
| Memory over a 90-question image test | no monotonic growth |

### 4.3 Risk register (FE)
| Risk | Mitigation |
|---|---|
| Math rendering architecture wrong → janky tests | FE-1.1 spike first; image fallback keeps authoring unblocked |
| Sub/sup baseline differences iOS vs Android | Unicode mapping + tested set (FE-1.3) |
| Presigned URLs defeat image cache | `cacheKey = mediaId` (FE-1.4) |
| Runtime refactor regresses live tests | Phase A "no behaviour change" + regression checklist (FE-4.14/4.24) |
| Authoring on phones is too slow for bulk | ZIP+CSV path (FE-2.9), sticky metadata defaults (FE-2.5), tablet two-pane (D22) |
| Backend lag blocks FE | "Start here" list (§1), dev fixtures behind `__DEV__` only (FE-0.7) |
| Scope explosion | Milestone gates; everything ships dark behind flags |

---

## 5. Rough effort by milestone (single FE dev, relative)

Computed from the task sizes above (S=1d, M=2.5d, L=5d, XL=10d); **re-estimate before planning**. Ranges cover tasks written `S/M`.

| Milestone | Tasks | Dev-days | ≈ Weeks (5-day) |
|---|---:|---:|---:|
| M0 Platform foundations | 8 | 11 | 2.2 |
| M1 Rich content/media renderer + teacher authoring | 35 | 108.5 | 21.7 |
| M2 Bookmarks, reports, ratings, admin queues | 10 | 24 | 4.8 |
| M3 Custom Test MVP | 24 | 70.5 | 14.1 |
| M4 Marrow-class | 15 | 39.5 | 7.9 |
| M5 Follow-on epics | 10 | 38–41 | 7.6–8.2 |
| **Total** | **102** | **291.5–294.5** | **58.3–58.9** |

**Reading these numbers honestly**
- **Sums of dev-days, not a calendar** — FE tasks overlap with BE via the "Start here" list (§1) and dev fixtures.
- **Custom Test MVP + images + teacher authoring = M0 + M1 + M3 ≈ 190 dev-days (~38 weeks)** for one FE developer. The two largest single items are the rich question editor (FE-2.4, XL) and Import v2 (FE-2.9, XL); the renderer (FE-1.x) is on every path.
- FE-6.3 (Flashcards) is a placeholder `XL` — it needs its own plan.
- Excludes QA on real devices, design iteration, and store-release overhead (native modules force a dev-client/EAS rebuild, FE-0.1).

---

## 6. FE ↔ BE dependency table

| FE task | Needs |
|---|---|
| FE-0.4 | BE-0.8 |
| FE-0.8, FE-4.15 | BE-0.4 |
| FE-1.7 – 1.9 | BE-1.21 (media map in payloads) |
| FE-1.11, 1.12, 2.6 | BE-1.1 – 1.3, 1.7 |
| FE-2.3, 2.4 | BE-1.13 (+1.10, 1.11, 1.12) |
| FE-2.9 | BE-1.17 – 1.20 |
| FE-2.10, 2.11, 2.12 | BE-1.15, 1.14, 1.16 |
| FE-2.13, 3.8 | BE-2.5 |
| FE-3.1 – 3.3 | BE-2.2 |
| FE-3.4, 3.5, 2.14 | BE-2.4 |
| FE-3.6, 3.7 | BE-2.6 |
| FE-4.3 – 4.7 | BE-3.10, 3.7, 3.11 |
| FE-4.8, 4.9 | BE-3.8, 3.6 |
| FE-4.11 | BE-3.9 |
| FE-4.13, 4.14 (phase B) | BE-3.12, 0.5 |
| FE-4.16 | BE-4.1 |
| FE-4.18, 4.19 | BE-3.13, 3.14, 4.3 |
| FE-5.x | BE-4.x |
| FE-6.x | BE-5.x |

If a backend task slips, the FE fallback is **hide the feature via its flag** — never ship a mock.


---

## 7. Implementation summary, verification and bug log

### 7.1 What is verified, and what is not
| Check | Result |
|---|---|
| `npx tsc --noEmit` (strict) | clean |
| `npx jest` | 7 suites, **133 tests** pass — rich-text parser (shared golden vectors with the Go server), blueprint validation (shared golden vectors), attempt timing / answer queue / palette, image planning, teacher form logic, push rules, editor text operations |
| `npx expo export --platform android` | full Metro + Hermes bundle succeeds (all imports resolve); run after most screens were written, the last few screens (flashcards, notifications, push) were type-checked but not re-bundled |
| Backend `go vet ./...`, `go test ./...` | clean / all green (60+ integration tests on real Postgres) |
| **Rendering, gestures, keyboard behaviour, camera/gallery, real R2 uploads, push, screenshot blocking, TalkBack/VoiceOver, 200 % fonts, dark theme visuals** | **NOT verified — needs devices** (`custom-test-module-qa.md`) |
| Native rebuild | **Required** (new native modules + permission strings) |

### 7.2 Known gaps (by design or time)
Math typesetting (FE-1.1/1.13), image prefetch (1.10), profiling (1.15), inventory hints (2.15), author help (2.17), question stats (2.18), sort by rating (3.7), teacher rating visibility (3.10), Explore (6.2), wellness rich rendering (6.5), video notes (6.6), P3 extras (6.9), taxonomy manager (5.14), time-analysis widget (5.6), strike-through (5.7), confidence picker (5.8), streak ring (5.15), teacher flashcard authoring and admin Brain-Hack approval screens, rendered-component tests, CI wiring. `Terms of Service` / `Privacy Policy` rows in Settings are pre-existing no-ops.

### 7.3 Bugs found and fixed along the way (pre-existing unless noted)
| # | Where | Problem | Fix |
|---|---|---|---|
| 1 | Test screen | Question palette looked up answers by index but answers were stored by question id → nothing ever showed "answered" | Answers keyed by id; unit-tested |
| 2 | Test screen | Timer computed from device clock and counted down in state → wrong after clock change/background | Server `expires_at` + `server_now` skew correction; absolute-deadline timer |
| 3 | Test screen | An answer that failed to save was lost silently after one banner | Persisted queue with backoff, restore after crash, flush before submit |
| 4 | Submit confirm | Called `GET review` on an *in-progress* attempt (404) and could race unsaved answers | Submit moved into the test screen (flush → submit); route removed |
| 5 | Exit dialog / others | `\u2014`, `\u2019` written in JSX text render literally | Real characters |
| 6 | Result | Fell back to a fabricated `/100` maximum; negative marking produced a negative ring | Guarded; hides unknowns |
| 7 | Review | Fake 10-minute "review countdown"; status by index | Removed; server filters + paging |
| 8 | History | Tapping an in-progress attempt opened the test screen with the *attempt* id | Uses test id |
| 9 | Pre-start | Marking displayed `--1`; "You answered 7 of 20" hard-coded; `isResume` always false | Real values (+ backend `active_attempt`) |
| 10 | Practice hub | "82 %" accuracy hard-coded | Computed from attempts |
| 11 | Home | "Day Streak 12" hard-coded; fake carousel copy; fake Brain-Hack ids that would 404 | Real streak; real carousel/shelf, hidden when empty |
| 12 | Progress | "Best streak: 23 days" invented; zero-filled trend | Removed; empty states |
| 13 | Brain Hacks (student + teacher) | Entirely mock data / fake timers; "Save Draft" was a `setTimeout` | Real API |
| 14 | Teacher create-test | Duration, marks never sent (all tests untimed); course always the first one; dead mock "rejected" branch | Sent; course/subject from picker |
| 15 | CSV report | "Done" opened *Create Test*; "Fix & Retry" opened builder without a test; template button did nothing | Rebuilt as check → import flow |
| 16 | **My change** | Listed `expo-screen-capture` in `app.json` plugins (no plugin exists → config fails to load) | Removed; found by starting Expo |
| 17 | **My change** | JSX text with `\u2019` in my own `ReportSheet` | Caught in review, fixed |
| 18 | Tooling | Typed-routes file stale after adding routes | Regenerated by starting Expo once |

### 7.4 Decisions still needed from the product owner
D19 bookmark list names/semantics · D20 stars vs. thumbs (stars used for content, thumbs for explanations) · D22 whether teachers author on phones or a web tool (phone editor built) · math rendering approach (D14) · whether to add a bottom tab for the teacher Question Bank.
