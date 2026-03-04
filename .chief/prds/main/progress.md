## Codebase Patterns
- Use `tsconfig.base.json` with `paths` for cross-package resolution; per-package tsconfigs extend it
- Root `tsconfig.json` with `noEmit` is used for whole-monorepo typecheck (`pnpm typecheck`)
- Per-package tsconfigs have `outDir`/`rootDir` for Vite builds but NOT `composite` (avoids needing built output for dev typecheck)
- Package names: `@vuepoint/core`, `@vuepoint/vue`, `@vuepoint/bridge`, `@vuepoint/mcp`, `@vuepoint/api`, `@jumpcloud/nuxt-vuepoint`
- Source files already use `@vuepoint/core` imports — no relative cross-package imports
- `.vue` files need `env.d.ts` shim for TypeScript (in packages/vue/src/)
- Stub components (AnnotationMarker.vue, AnnotationPanel.vue) created for VuePointToolbar imports
- `vite` devDep needed in packages/vue for `import.meta.env` types
- `@types/node` at root for `process.env` in plugin.ts production guard
- Many US stories may already have working implementations from the original 11 source files — verify before writing new code
- Vue SFC: only `<script setup>` bindings are template-accessible; use `defineOptions({ name })` instead of a separate `<script>` block
- Build: `vite-plugin-dts` (with `rollupTypes: true`) for declaration bundling; `@vitejs/plugin-vue` for SFC compilation
- Build: `packages/vue/tsconfig.build.json` with empty `paths: {}` prevents DTS from following `@vuepoint/core` source
- Build: MCP and API packages are ESM-only (no CJS) since they're Node.js CLI entry points
- Build: `exports` field in package.json must list `types` before `import`/`require`

---

## 2026-03-04 - US-001
- Scaffolded pnpm monorepo with 7 packages: core, vue, bridge, mcp, api, nuxt, playground
- Moved 11 source files to correct package locations (types/selector/output/filter → core, composables/plugin/components → vue, server → mcp, api → api)
- Created barrel exports (index.ts) for @vuepoint/core and @vuepoint/vue
- Created stub components (AnnotationMarker.vue, AnnotationPanel.vue) to satisfy VuePointToolbar imports
- Created env.d.ts for .vue file type declarations
- Root tsconfig.json uses paths mapping to source for development typecheck
- pnpm install succeeds, `tsc --noEmit` passes across all packages
- Files changed: 36 files (new package.json, tsconfig.json, index.ts files + file moves)
- **Learnings for future iterations:**
  - `composite` project references + `--noEmit` don't work well when dist/ doesn't exist yet; use `paths` mapping instead
  - The original source files already had correct `@vuepoint/core` imports, so no import rewrites were needed
  - VuePointToolbar.vue imports AnnotationMarker.vue and AnnotationPanel.vue which needed stubs
  - `process.env.NODE_ENV` in plugin.ts needs `@types/node`, `import.meta.env.PROD` needs `vite` types
---

## 2026-03-04 - US-002
- Created `vite.config.ts` in all 4 publishable packages: core, vue, mcp, api
- @vuepoint/core: Vite library mode → ESM (`index.js`) + CJS (`index.cjs`) + declarations (`index.d.ts`)
- @vuepoint/vue: Vite library mode + `@vitejs/plugin-vue` for SFC compilation → ESM + CJS + dts + CSS
- @vuepoint/mcp: Vite library mode targeting Node 18 → ESM entry point (`server.js`)
- @vuepoint/api: Vite library mode targeting Node 18 → ESM entry point (`api.js`)
- Added `vite-plugin-dts` and `@vitejs/plugin-vue` as root devDeps
- Added `vite` devDep to core, mcp, api packages
- Created `tsconfig.build.json` for vue package (empty `paths` to avoid DTS rootDir errors)
- Fixed `exports` field ordering in core and vue package.json (`types` first)
- Updated all build scripts from placeholder `echo` to `vite build`
- `pnpm build` succeeds; `pnpm typecheck` passes clean
- Files changed: 4 new vite.config.ts, 1 new tsconfig.build.json, 6 modified package.json, pnpm-lock.yaml
- **Learnings for future iterations:**
  - `vite-plugin-dts` follows tsconfig `paths` and will try to generate declarations for cross-package sources — use a separate `tsconfig.build.json` with empty `paths` to prevent this
  - `rollupTypes: true` in vite-plugin-dts produces a single bundled `.d.ts` file (uses @microsoft/api-extractor under the hood)
  - MCP and API packages use top-level `await` so must be ESM-only (no CJS output)
  - pnpm `-r` automatically handles build order based on workspace dependency topology
---

## 2026-03-04 - US-003
- Verified existing `useVueInspector.ts` implementation meets all acceptance criteria
- Component hierarchy walker: walks `__vueParentComponent` up DOM, then Vue instance tree via `parent`
- Name resolution: `__name` → `name` → `filenameToName(__file)` priority chain
- SFC path normalization: strips absolute prefix, returns `src/...` relative path
- Vue built-ins filtered via `VUE_BUILTINS` set in `primevue-filter.ts`
- Chain reversed to root-to-leaf order (`App → Page → Leaf`)
- Typecheck passes clean
- Files changed: prd.json (mark passes), progress.md
- **Learnings for future iterations:**
  - US-001 moved all 11 original source files intact — many stories may already have working implementations that just need verification + typecheck
  - `useVueInspector` returns a composable factory pattern: call with options, get back bound functions — this is the project's preferred Vue composable style
  - The `__vueParentComponent` property is only present in Vue 3 dev builds — production guard in plugin.ts ensures VuePoint is never active in prod
---

## 2026-03-04 - US-004
- Verified existing `selector.ts` implementation meets all acceptance criteria
- `generateSelector()`: walks up DOM building unique CSS path, stops at unique anchors (#id, [data-testid])
- Priority chain: #id → [data-testid/data-cy/data-e2e/aria-label/name/role] → tag+classes → :nth-child()
- MAX_DEPTH = 8, enforced in the walk loop
- `describeElement()`: returns human-readable summary (text content, aria-label, input type, img alt)
- Both functions already exported from `@vuepoint/core` barrel
- Typecheck passes clean
- Files changed: prd.json (mark passes), progress.md
- **Learnings for future iterations:**
  - `selector.ts` also filters dynamic classes (Tailwind JIT, CSS modules) via heuristics — skip classes >30 chars, starting with digit, or looking like hex hashes
  - `CSS.escape()` is used for IDs to handle special characters
  - Auto-generated IDs (`:r0:` pattern from React/frameworks) are excluded from the ID strategy
---

## 2026-03-04 - US-005
- Verified existing `output.ts` implementation meets all acceptance criteria
- `formatAnnotation()`: outputs structured Markdown with Element, Selector, Component chain, SFC Path, Pinia Stores, Route, Feedback, Expected, Actual
- `formatAnnotationBatch()`: formats multiple annotations with `### Annotation [id]` headers and `---` separators, filters to pending only
- Optional fields (expected, actual, piniaStores) conditionally omitted when empty/undefined
- Output uses `**Key:** \`value\`` format — greppable and machine-parseable
- Both functions already exported from `@vuepoint/core` barrel
- Typecheck passes clean
- Files changed: prd.json (mark passes), progress.md
- **Learnings for future iterations:**
  - `formatAnnotationBatch` only outputs `pending` annotations — resolved/dismissed are excluded from batch copy
  - The output format also supports opt-in fields via `MarkdownOutputOptions`: `includeScreenshot` and `includeProps`
  - `generateId()` and `now()` utility functions are co-located in output.ts for annotation creation
---

## 2026-03-04 - US-006
- Verified existing `primevue-filter.ts` implementation meets all acceptance criteria
- `PRIMEVUE_FILTER`: 35 PrimeVue internal component names (icons, portals, transitions, focus traps, virtual scrollers)
- `VUE_BUILTINS`: 10 Vue built-in names always filtered (Transition, KeepAlive, Suspense, Teleport, Fragment, etc.)
- `buildFilter()`: `false` → empty Set, `string[]` → builtins + custom, `undefined` → builtins + PrimeVue defaults
- `VuePointOptions.filterComponents` typed as `string[] | false` in types.ts
- All exports in `@vuepoint/core` barrel
- Typecheck passes clean
- Files changed: prd.json (mark passes), progress.md
- **Learnings for future iterations:**
  - `buildFilter(customArray)` unions custom list WITH Vue builtins — builtins can never be shown unless `false` is passed
  - Vue builtins include RouterView/RouterLink — these are framework components that shouldn't appear in annotation chains
---

## 2026-03-04 - US-007
- Verified existing `useAnnotations.ts` composable meets all acceptance criteria
- Added missing `resolved` computed filter (only `pending` existed before)
- Store uses `ref`/`computed`/`readonly` — no Pinia dependency
- CRUD: `create()`, `update()`, `acknowledge()`, `resolve()`, `dismiss()`, `remove()`, `clear()`
- Each annotation gets unique ID via `generateId()` and ISO timestamp via `now()` on creation
- Status lifecycle enforced: pending → acknowledged → resolved | dismissed
- Symbol-based provide/inject (`VUEPOINT_ANNOTATIONS_KEY`) for host-app isolation
- Typecheck passes clean
- Files changed: useAnnotations.ts (added `resolved` computed), prd.json, progress.md
- **Learnings for future iterations:**
  - The `AnnotationsStore` type is derived via `ReturnType<typeof useAnnotationsStore>` — any new properties added to the return object auto-propagate to consumers
  - `readonly()` wrapping on `annotations` prevents external mutation but internal `annotations.value` is still mutable for CRUD
  - `update()` spreads `updatedAt: now()` on every mutation — all status changes go through `update()` for consistent timestamps
---

## 2026-03-04 - US-008
- Verified existing `plugin.ts` implementation meets all acceptance criteria
- `app.use(VuePoint)` works with zero config (options defaults to `{}`)
- `app.use(VuePoint, { ...options })` accepts full `VuePointOptions`
- Production guard: checks `process.env.NODE_ENV !== 'production'` and `!import.meta.env?.PROD`
- Toolbar mounted in isolated Vue app via `createApp()` on `<div id="__vuepoint-root">` — never appears in host `__vueParentComponent` chain
- Keyboard shortcut parsed from string format (`ctrl+shift+a`) and registered on `keydown`
- Typecheck passes clean
- Files changed: prd.json (mark passes), progress.md
- **Learnings for future iterations:**
  - The isolated app pattern (`createApp` + separate mount point) is how VuePoint avoids contaminating the host app's component tree — important for annotation accuracy
  - `registerShortcut()` supports ctrl/meta/shift/alt modifiers and prevents default on match
  - The `__VUE__` global is only present in Vue dev builds — plugin warns if missing
---

## 2026-03-04 - US-009
- Verified existing VuePointToolbar.vue implementation covers full click-to-annotate flow
- Fixed runtime bug: `highlightStyle()` was in a separate `<script>` block (not accessible to `<script setup>` template), moved into `<script setup>`
- Replaced separate `<script>` block's `defineComponent({ name })` with `defineOptions({ name: 'VuePointToolbar' })` in `<script setup>`
- All acceptance criteria met: FAB button, annotate mode with crosshair cursor, hover highlight, click capture (selector/chain/SFC/route), feedback modal, store creation, annotation markers (stub), Copy All to clipboard, keyboard shortcut toggle
- Typecheck passes clean
- Files changed: VuePointToolbar.vue (bug fix + modernization), prd.json, progress.md
- **Learnings for future iterations:**
  - In Vue 3 SFCs with both `<script setup>` and `<script>`, only `<script setup>` bindings are available in the template — functions in the regular `<script>` block are module exports, not template bindings
  - `defineOptions({ name })` (Vue 3.3+) replaces the need for a separate `<script>` block when you only need to set the component name
  - `tsc --noEmit` with `.vue` shims doesn't catch template binding errors — consider vue-tsc for deeper SFC checking
---
