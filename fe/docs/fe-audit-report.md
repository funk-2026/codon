# Codon FE audit: DRY and navigation

Scope: `fe/app` (120 route files, ~25.5k lines) and `fe/src` (~11.2k lines). Measured with grep and line-diff similarity on 2026-11-11. Percentages are line-level similarity, and line-savings are estimates.

## 1. Headline findings

| # | Finding | Evidence |
|---|---------|----------|
| 1 | Tab bar shows on every pushed screen (student and admin) | `Tabs` holds a nested `Stack` per tab, so the tab bar belongs to the parent and stays under every pushed screen |
| 2 | Three screens are copy-pasted across roles | `give-feedback` 100% identical x3, `manage-devices` 96-98% x3 |
| 3 | Two big screens are the same screen twice | `learn/hierarchy` vs `practice/hierarchy`: 78% similar, 486 + 559 lines |
| 4 | Every screen hand-rolls its header | 70 files have their own back button + title; the shared `HeaderBand` is used in 1 file, `CollapsingHeader` in 4 |
| 5 | Stack `title:` options are dead config | Base options set `headerShown: false`, so titles like "Browse" and "Test History" are never shown natively |
| 6 | No safe-back handling | 104 `router.back()` calls, 0 `canGoBack()` checks. A deep link or notification into a detail screen has nowhere to go back to |
| 7 | Route strings are typed by hand | 161 `push`, 45 `replace`, ~60 distinct route literals, all as raw strings |
| 8 | Logic lives in route files | `app/` is 25.5k lines vs 11.2k in `src/`; 24 screens over 300 lines, biggest 777 |
| 9 | No shared data-loading layer | 83 files load in `useEffect`, 63 keep a manual `loading` flag, 21 a manual `error` flag, 77 `try/catch` blocks; no query library |
| 10 | Styles repeated | `shadowStyle` helper pasted into 5 files, `shadowColor: '#000'` in 48 places, `scrim`/`modalCard` in 10-15 files, 17 raw `<Modal>` despite `BottomSheet` existing |

What is already good: colours and type go through theme tokens (about 3,000 token uses, only 3 stray hex files), the `src/api` layer is cleanly split into 33 modules, `src/rich` and `src/attempt` are well factored, and the root uses `Stack.Protected` for auth gating.

## 2. DRY report

### 2.1 Identical or near-identical screens

| Files | Similarity | Fix |
|-------|-----------|-----|
| `give-feedback.tsx` in student, teacher, admin profile | 100% | One shared screen in `src/screens/`, route files re-export it |
| `manage-devices.tsx` in student, teacher, admin profile | 96-98% | Same |
| `(learn)/hierarchy.tsx` and `(practice)/hierarchy.tsx` | 78% | One `HierarchyBrowser` with a `mode` prop (learn or practice) |
| Teacher and admin profile index | 68% | Shared `ProfileScreen` with role-specific sections |
| Student, teacher, admin tab layouts | 80-84% | One `RoleTabs` component driven by a config array |
| ~15 per-tab `Stack` layouts | same shape | One `createTabStack(screens)` helper, or remove them (see section 3) |

Estimated removable lines from this table alone: about 1,500.

### 2.2 Missing shared components

| Missing primitive | Currently |
|-------------------|-----------|
| `Screen` (SafeAreaView + canvas background + padding) | Re-written in every screen |
| `ScreenHeader` (back, title, right action) | 70 hand-rolled copies, about 12 lines each |
| `Chip` | `chip` style in 19 files |
| `ListRow` | `row` style in 30 files |
| `SectionLabel` | Re-typed overline text style |
| `ConfirmDialog` / `ModalCard` | `scrim` + `modalCard` in 10-15 files, 17 raw `Modal` |
| `useShadow('card')` | 5 copies of `shadowStyle` + 48 inline shadows |

Estimated removable lines: about 1,500-2,000.

### 2.3 Data loading

No shared hook, so each screen re-implements: loading flag, error flag, try/catch, `useEffect`, refetch on focus (24 `useFocusEffect`). Recommend TanStack Query (or at minimum a `useAsync(fn, deps)` hook). It also gives caching between tabs, which matters because tabs stay mounted.

### 2.4 Oversized files (split candidates)

`custom-builder` 777, `practice/hierarchy` 559, `test-question` 554, `student home` 535, `content-preview` 533, `video-player` 492, `learn/hierarchy` 486, `create-content` 476, `test-review` 466. Target: route files under 150 lines that compose components from `src/`.

### 2.5 Estimated overall effect

About 3,000-4,000 of 25.5k route-file lines can be removed or moved into shared code. This is an estimate, not measured.

## 3. Navigation report

### 3.1 Why the tab bar persists

```
(student)/_layout   Tabs                <- tab bar lives here
  (practice)/_layout   Stack            <- pushes happen here
     index, test-pre-start, test-question, ...
```

A pushed screen is inside the tab's stack, so it renders above nothing: the tab bar belongs to the parent and stays visible on every screen, including mid-test (`test-question`), `video-player` and `checkout`. Admin has the same shape. Teacher is already half-fixed: detail screens are root-level siblings of `(tabs)`, which is the pattern to copy.

### 3.2 Can visibility be screen-specific? Yes. Two ways.

**Option A (recommended): hoist detail screens above the tabs.**

```
(student)/_layout          Stack
  (tabs)/_layout           Tabs, each tab is ONE screen (hub only)
    (home)/index, (practice)/index, (learn)/index, (support)/index, (profile)/index
  test-pre-start, test-question, test-result, hierarchy, video-player, checkout, ...
```

- The tab bar exists only inside `(tabs)`, so any pushed screen covers it with the native slide animation. The bar leaves with the screen, which is the "translates down" behaviour.
- Back always returns to the tab you came from, which removes the cross-tab confusion. Today there are about 28 pushes from one tab into another tab's stack (e.g. Home to Practice `custom-builder`, Practice to Learn `video-player`, and 11 to `subscription-plans`), kept alive by `unstable_settings` workarounds.
- Cost: moving files and updating route strings (`/(student)/(practice)/test-pre-start` becomes `/(student)/test-pre-start`). This is mechanical and can be codemodded; typed routes will flag any miss.

**Option B: keep the structure, hide the bar per route.** Use a custom `tabBar` that reads the focused nested route and animates it down with Reanimated whenever the route is not `index`. No file moves, but the bar animates separately from the screen transition, layout can jump when the bar's space is reclaimed, and all the cross-tab and nested-stack complexity stays.

Recommendation: Option A.

### 3.3 End-to-end navigation fixes

1. **Hoist** detail screens above the tabs (student, admin; teacher's remaining `course-structure-manager` and the `(home)` stack too). Delete `unstable_settings` and the nested stack layouts.
2. **One route map** in `src/navigation/routes.ts` (e.g. `routes.student.testPreStart({ id })`) so the 206 push/replace calls stop using raw strings.
3. **One header**: either enable native headers for plain-title screens and delete the 70 hand-rolled ones, or ship a single `ScreenHeader`. Remove the dead `title:` options either way.
4. **`useSafeBack(fallbackRoute)`** replacing bare `router.back()`, so deep links and push notifications always have a way out.
5. **Flow endings**: use `replace` or `dismissTo` after submit, payment and result screens so Back does not return into a finished test or checkout (45 `replace` calls exist today; audit each flow).
6. **Full-screen flows** (`test-question`, `video-player`, `custom-builder`, `preview-run`, `checkout`, KYC submission) should be root-level, with gesture-back disabled or confirm-on-exit where work can be lost.
7. **Role guards**: the root guards only on `authenticated`, not on role, so `(student)`, `(teacher)` and `(admin)` are all reachable by any signed-in user. Add per-role `Stack.Protected` guards (verify what the server enforces first).

## 4. Suggested order for P2

1. Navigation hoist (fixes the tab bar bug, removes the nested-stack workarounds).
2. Shared primitives: `Screen`, `ScreenHeader`, `Chip`, `ListRow`, `ConfirmDialog`, `useShadow`.
3. De-duplicate role-shared screens and the two hierarchy screens.
4. Data-loading hook or TanStack Query.
5. Split the oversized route files.
6. Route map, safe-back and role guards.
