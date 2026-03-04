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
- Bridge architecture: Browser tabs → SharedWorker (postMessage) → API server (fetch) ← MCP server (HTTP); API pushes back via WebSocket → SharedWorker → tabs
- Use `_bridgeSyncing` flag pattern to prevent infinite sync loops between local store mutations and bridge events
- Vue SFC: only `<script setup>` bindings are template-accessible; use `defineOptions({ name })` instead of a separate `<script>` block
- Build: `vite-plugin-dts` (with `rollupTypes: true`) for declaration bundling; `@vitejs/plugin-vue` for SFC compilation
- Build: `packages/vue/tsconfig.build.json` with empty `paths: {}` prevents DTS from following `@vuepoint/core` source
- Build: MCP and API packages are ESM-only (no CJS) since they're Node.js CLI entry points
- Build: `exports` field in package.json must list `types` before `import`/`require`
- pnpm `--filter` uses the package `name` field, not the directory name (e.g., `--filter vuepoint-playground`)
- PrimeVue 4: `@primevue/themes` for presets, `Select` (not `Dropdown`), `ToggleSwitch` (not `InputSwitch`)
- Use `nextTick` in plugin `install()` to defer access to `$router` / Pinia — handles any plugin registration order

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

## 2026-03-04 - US-010
- Implemented full AnnotationMarker.vue replacing the stub
- Badge positioned absolutely at target element's top-right corner using `document.querySelector(annotation.selector)`
- Scroll/resize tracking via event listeners with `requestAnimationFrame` debouncing
- Re-finds target element if it disconnects from DOM (`el.isConnected` check)
- Status-based colors: pending=blue, acknowledged=orange, resolved=green, dismissed=gray
- Emits `select` event on click; wired to VuePointToolbar to open panel
- Modernized from dual `<script>` block to `defineOptions({ name })` pattern
- Updated VuePointToolbar.vue to handle `@select` event from markers
- Typecheck passes clean
- Files changed: AnnotationMarker.vue (full rewrite), VuePointToolbar.vue (added handleMarkerSelect + @select binding), prd.json, progress.md
- **Learnings for future iterations:**
  - `document.querySelector()` with a complex CSS selector can throw on invalid selectors — wrap in try/catch
  - `el.isConnected` is the modern way to check if an element is still in the DOM (cheaper than `document.contains()`)
  - Scroll events need `capture: true` to catch scroll events on nested scrollable containers, not just window scroll
  - `requestAnimationFrame` debouncing prevents layout thrashing during rapid scroll events
---

## 2026-03-04 - US-011
- Implemented full AnnotationPanel.vue replacing the stub
- Scrollable list rendering all annotations with number badge, element description, feedback text, and status badge
- Status-colored number badges matching AnnotationMarker colors (pending=blue, acknowledged=orange, resolved=green, dismissed=gray)
- Delete button per item calls `store.remove(id)` with `@click.stop` to prevent scroll-to-element
- Click on item calls `document.querySelector(selector).scrollIntoView({ behavior: 'smooth', block: 'center' })`
- Empty state with pencil icon and hint text when no annotations exist
- Panel header with title and close button (emits `close` event)
- Custom scrollbar styling, `-webkit-line-clamp: 2` for feedback truncation
- Typecheck passes clean
- Files changed: AnnotationPanel.vue (full rewrite from stub), prd.json, progress.md
- **Learnings for future iterations:**
  - The toolbar conditionally renders the panel with `v-if="isExpanded && mode === 'panel'"` — panel visibility is controlled by the toolbar, not the panel itself
  - `store.annotations` is a `readonly` ref — access `.value` in templates (not unwrapped like Pinia stores)
  - `@click.stop` on delete buttons prevents the parent `@click` (scroll-to-element) from firing — important for nested click handlers
  - Status badge uses dynamic class `:class="vp-status--${ann.status}"` for shared color theming between number badge and label
---

## 2026-03-04 - US-012
- Added collapsible Expected/Actual text fields to the feedback modal in VuePointToolbar.vue
- Fields hidden by default behind a chevron toggle button ("Expected / Actual")
- Values passed as `expected`/`actual` to `annotationsStore.create()` (empty string → `undefined`)
- All state (`expectedText`, `actualText`, `showExpectedActual`) cleared on submit, cancel, and exitAnnotationMode
- Types already supported `expected`/`actual` on `Annotation` and `AnnotationCreateInput`
- `output.ts` already conditionally includes Expected/Actual in Markdown output
- Typecheck passes clean
- Files changed: VuePointToolbar.vue (template + script + styles), prd.json, progress.md
- **Learnings for future iterations:**
  - Many UI stories only need template+style changes because the types and formatters were designed upfront with optional fields
  - The `.vp-feedback-input--sm` CSS modifier reuses the base input class — keeps styles DRY for secondary textareas
  - Chevron rotation via CSS `transform: rotate(180deg)` with a transition is the simplest open/close indicator
---

## 2026-03-04 - US-013
- Implemented dark/light mode toggle for the entire VuePoint toolbar UI
- Theme system uses CSS custom properties (`--vp-*`) defined on `.vp-root`, switched via `data-vp-theme` attribute
- 15 theme tokens cover all surface, text, border, shadow, and accent colors
- Sun/moon toggle button added to toolbar (between annotate FAB and count badge)
- Auto-detects system preference via `prefers-color-scheme` media query
- Persists user choice in `localStorage` under `vuepoint-theme` key
- All three components updated: VuePointToolbar (variables + toggle), AnnotationPanel (var references with dark fallbacks), AnnotationMarker (shadow token)
- Status badge colors (pending/acknowledged/resolved/dismissed) remain constant across themes for consistent visual semantics
- Typecheck passes clean
- Files changed: VuePointToolbar.vue (theme state + CSS vars + toggle button), AnnotationPanel.vue (var references), AnnotationMarker.vue (shadow var), prd.json, progress.md
- **Learnings for future iterations:**
  - CSS custom properties cascade through Vue scoped styles — parent's vars are available to child components since they're set on the actual DOM element, not just in CSS scope
  - Using `var(--token, fallback)` in child components ensures they work standalone even if parent vars aren't set
  - Theme-agnostic colors (status badges, red delete) should NOT be tokenized — they're semantic constants
  - `localStorage` + `prefers-color-scheme` is the standard detect-then-persist pattern; stored value always takes priority over system preference
---

## 2026-03-04 - US-014
- Created full playground Vue 3 + Vite app with PrimeVue 4, Pinia, and Vue Router
- Package: `vuepoint-playground` with `pnpm dev` (Vite dev server on :5173)
- PrimeVue configured with Aura theme preset, using DataTable, Column, Button, Dialog, InputText, Tag, ToggleSwitch, Select components
- VuePoint installed via workspace link (`@vuepoint/vue: workspace:*`) with Pinia integration enabled
- Pinia store: `useUsersStore` with sample user data (5 users), search/filter, CRUD operations
- Three routes: Home (/), Users (/users), Settings (/settings) — tests route context capture
- UsersView: DataTable with search, add user dialog, status toggle, delete — realistic PrimeVue CRUD
- SettingsView: Form with InputText, Select, ToggleSwitch — demonstrates form component annotation
- HomeView: Landing page with feature cards
- App.vue: Header with navigation buttons, router-view
- Fixed root package.json `dev` script filter: `--filter vuepoint-playground` (pnpm uses package name, not directory name)
- Updated root tsconfig.json to include playground/src in typecheck
- `pnpm dev` starts with hot reload, `pnpm typecheck` passes clean
- Files changed: playground/ (9 new files: package.json, index.html, vite.config.ts, tsconfig.json, env.d.ts, main.ts, router.ts, stores/users.ts, App.vue + 3 views), root package.json, root tsconfig.json, pnpm-lock.yaml, prd.json, progress.md
- **Learnings for future iterations:**
  - pnpm `--filter` uses the package `name` field, not the directory name — `--filter vuepoint-playground`, not `--filter playground`
  - PrimeVue 4 uses `@primevue/themes` package for presets (Aura, Lara, etc.) instead of the old `primevue/themes` path
  - PrimeVue 4 component names changed: `Dropdown` → `Select`, `InputSwitch` → `ToggleSwitch`
  - Playground tsconfig should extend `tsconfig.base.json` to get the `@vuepoint/*` path aliases for source-level dev
  - `vue-tsc` is the proper typecheck tool for Vue SFCs but the root `tsc --noEmit` with `.vue` shims works for the monorepo typecheck
---

## 2026-03-04 - US-023
- Implemented SharedWorker bridge for browser ↔ Node.js state sync
- Created `packages/bridge/src/types.ts` — message protocol (BridgeCommand, BridgeEvent, AppContext)
- Created `packages/bridge/src/worker.ts` — SharedWorker that holds canonical annotation state, broadcasts to all tabs, syncs to API server via fetch(), receives API updates via WebSocket
- Created `packages/bridge/src/client.ts` — browser-side client with typed API (connect, syncAnnotation, updateAnnotation, removeAnnotation, clearAnnotations, updateContext, onEvent)
- Updated `packages/bridge/src/index.ts` — exports client and types
- Added WebSocket support to `packages/api/src/api.ts` — `@fastify/websocket` plugin, `/ws` endpoint, `broadcastWs()` on PATCH and DELETE to push MCP agent updates to browser
- Wired bridge client into `packages/vue/src/plugin.ts` — monkey-patches annotation store methods to sync to bridge, listens for events from other tabs
- Added `_bridgeSyncing` flag to prevent infinite loops when receiving events from other tabs
- Updated package.json files: bridge (exports), vue (+@vuepoint/bridge dep), api (+@fastify/websocket dep, +@types/ws devDep)
- `pnpm typecheck` passes clean; `pnpm build` succeeds
- Files changed: 7 new/modified files in bridge/, 2 modified in api/, 2 modified in vue/, prd.json, progress.md, pnpm-lock.yaml
- **Learnings for future iterations:**
  - SharedWorker `self.addEventListener('connect')` type needs manual declaration because `WebWorker` lib conflicts with `DOM` lib in the root tsconfig
  - `@fastify/websocket` uses `ws` under the hood — import `type { WebSocket } from 'ws'` for the socket type in handlers
  - Bridge sync needs a re-entrancy guard (`_bridgeSyncing`) to prevent store.create → bridge.sync → bridge.onEvent → store.create infinite loops
  - SharedWorker constructor needs `{ type: 'module' }` option when the worker uses ES module imports
  - `import.meta.url` in the bridge client auto-resolves the worker.js URL relative to the client module — Vite handles this in dev
---

## 2026-03-04 - US-024
- Added context sync to `plugin.ts` — pushes route and Pinia store info to bridge on navigation
- Uses `nextTick` to defer setup until after all `app.use()` calls complete (handles VuePoint installed before router)
- `setupContextSync()` accesses `$router` via `app.config.globalProperties` and Pinia via `options.pinia.instance._s`
- `buildContext()` collects: route path, route name, deepest matched page component name, active Pinia store IDs
- Initial context pushed immediately, then `router.afterEach()` pushes on every navigation
- No changes needed to bridge/worker/API/MCP — all context endpoints were already implemented in US-023
- Typecheck passes clean; build succeeds
- Files changed: plugin.ts (context sync logic), prd.json, progress.md
- **Learnings for future iterations:**
  - `nextTick` in Vue's `install()` defers until after all synchronous `app.use()` calls complete — safe way to access router/pinia regardless of plugin registration order
  - Vue Router's `afterEach` guard is the right hook for context sync — fires after navigation confirms, not before
  - Pinia's `_s` property (Map<storeId, StoreInstance>) is an undocumented but stable internal that lists all instantiated stores
  - The `matched` array on Vue Router's route contains route records with `components.default` — the deepest match is the page-level component
  - Component name resolution mirrors `useVueInspector`: `__name` → `name` → filename extraction from `__file`
---

## 2026-03-04 - US-025
- MCP server already had all 8 tools implemented from initial scaffold — verified end-to-end
- Added Zod validation to `vuepoint_get_annotations` (status enum with default) and `vuepoint_get_component_info` (optional selector/name)
- Created `cli.ts` — CLI entry point with `mcp` subcommand so `npx vuepoint mcp` works
- Updated `vite.config.ts` to build both `server.js` and `cli.js` entry points
- Added `vuepoint` bin entry in package.json alongside existing `vuepoint-mcp`
- All 8 tools: get_annotations, get_annotation, acknowledge, resolve, dismiss, ask, get_component_info, get_app_context
- All tools now use Zod for input validation
- Typecheck and build pass clean
- Files changed: server.ts (Zod additions), cli.ts (new), vite.config.ts (multi-entry), package.json (bin), prd.json, progress.md
- **Learnings for future iterations:**
  - Top-level `await` in a TS file without imports requires `export {}` to be treated as a module by TypeScript
  - Vite multi-entry config uses `entry: { name: 'path' }` object instead of a single string
  - The MCP SDK `@modelcontextprotocol/sdk` uses deep path imports (e.g., `/server/index.js`) which must be individually externalized in Vite
---
