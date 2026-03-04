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
- `getBoundingClientRect()` returns viewport-relative coords — compare with `clientX`/`clientY`, not `pageX`/`pageY`, for `position: fixed` overlays
- Nuxt runtime plugins use `#imports` virtual module — exclude `packages/nuxt/src/runtime/**` from root tsconfig
- Use `nextTick` in plugin `install()` to defer access to `$router` / Pinia — handles any plugin registration order
- Pinia stores have `$id` property — use this to detect store references in Vue component `setupState`
- ESLint: flat config with `no-undef: off` for TS projects; use `flat/essential` for Vue plugin to avoid template formatting noise
- Chrome extension (MV3): IIFE format required; use separate Vite builds per entry via `VITE_ENTRY` env var
- Packages with platform-specific types (e.g., `@types/chrome`) must be excluded from root tsconfig to avoid polluting other packages
- Quality scripts: `pnpm typecheck`, `pnpm lint`, `pnpm test` — all must pass for CI
- Vitest config at root with `passWithNoTests: true` until test files are added

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

## 2026-03-04 - US-026
- REST API already had ~95% of functionality from initial scaffold — applied targeted fixes
- Fixed default port from 3741 → 3742 (3741 is the bridge port, 3742 is the REST API port per architecture)
- Added CSV export format to GET /api/v1/annotations/export with proper escaping and Content-Disposition header
- Fixed markdown export to include all annotations (not just pending) — uses `formatAnnotation` directly instead of `formatAnnotationBatch` which filters to pending-only
- Added optional `?status=` filter to export endpoint for filtered exports
- Added `/api/v1/health` endpoint alongside existing `/health` (both skip auth)
- All AC verified: Fastify on :3742, full CRUD, export (JSON/Markdown/CSV), component query, context, health, bearer auth, CORS
- Typecheck passes clean; build succeeds
- Files changed: api.ts (port, export, health), prd.json, progress.md
- **Learnings for future iterations:**
  - `formatAnnotationBatch` is designed for clipboard copy (pending-only), not for data export — use `formatAnnotation` in a loop for export endpoints
  - CSV escaping: wrap in double quotes if value contains comma, quote, or newline; double-escape internal quotes
  - Fastify route handlers can be shared as function references — `app.get('/a', handler); app.get('/b', handler)` avoids duplication
---

## 2026-03-04 - US-027
- Webhook engine was ~90% implemented from initial scaffold — applied targeted fixes to complete all 8 event types
- Added `session.started` webhook fire on API server boot (after `app.listen`)
- Added `session.ended` webhook fire on graceful shutdown (SIGINT/SIGTERM handlers)
- Added `POST /api/v1/webhooks/batch-copied` endpoint for browser to trigger `annotation.batch_copied` event after clipboard copy
- Fixed `POST /api/v1/webhooks/test` to look up configured webhook's secret for HMAC signing (was passing `undefined`)
- Verified all 8 events: annotation.created/updated/acknowledged/resolved/dismissed fired on CRUD, batch_copied via new endpoint, session.started/ended on lifecycle
- HMAC-SHA256 signing, retry with exponential backoff (1s→5s→30s), webhook filtering by event type all already working
- Typecheck passes clean; build succeeds
- Files changed: api.ts (session lifecycle events, batch_copied endpoint, test endpoint secret fix), prd.json, progress.md
- **Learnings for future iterations:**
  - The initial scaffold often has 80-95% of functionality — always verify existing code against AC before writing new code
  - Session lifecycle events need to be fired AFTER server is listening (not during setup) to avoid race conditions
  - Process signal handlers (`SIGINT`/`SIGTERM`) should `await` async cleanup before `process.exit()` to ensure webhook delivery completes
  - The test webhook endpoint should use the configured secret for the target URL — otherwise test deliveries won't match production HMAC signatures
---

## 2026-03-04 - US-015
- Implemented Shift+drag multi-select annotation in VuePointToolbar.vue
- Added `AnnotationElement` type to `@vuepoint/core` types for multi-element annotation data
- Updated `AnnotationCreateInput` to accept optional `elements` array
- Added drag-select logic: Shift+mousedown starts drag, mousemove draws selection rectangle, mouseup captures all leaf elements intersecting the rectangle
- Selection rectangle rendered as fixed-position dashed border overlay with accent color
- Elements captured by checking `getBoundingClientRect()` intersection with selection rect, filtering to leaf elements only
- Multi-element annotations use summary selector `[multi-select: N elements]` and store individual element details in `elements` array
- Updated Markdown output formatter to include multi-select element listing
- Feedback modal header shows "Multi-select (N elements)" for multi-element annotations
- Minimum drag size (10px) prevents accidental small drags from triggering multi-select
- Typecheck passes clean; build succeeds
- Files changed: types.ts (AnnotationElement type + elements field), index.ts (export), output.ts (multi-element formatting), VuePointToolbar.vue (drag state, handlers, template, CSS), prd.json, progress.md
- **Learnings for future iterations:**
  - `document.querySelectorAll('body *')` with `el.children.length === 0` is an efficient way to get only leaf elements for intersection testing
  - `getBoundingClientRect()` returns viewport-relative coordinates — use `clientX`/`clientY` (not `pageX`/`pageY`) for consistent comparison with `position: fixed` overlay
  - Shift+mousedown in capture phase must call `stopPropagation()` to prevent the regular click handler from also firing
  - The `readonly()` wrapper in useAnnotations deeply freezes arrays — DTS build shows type warnings when passing readonly annotations to functions expecting mutable `Annotation[]` (pre-existing issue, not blocking)
---

## 2026-03-04 - US-016
- Implemented Alt+drag area selection annotation in VuePointToolbar.vue
- Added `areaRect?: AnnotationRect` to `Annotation` and `AnnotationCreateInput` types
- Alt+drag draws an orange-tinted selection rectangle (distinct from Shift+drag blue multi-select)
- On drag end, captures: bounding rect coordinates (x, y, width, height, scrollX, scrollY), and all leaf elements within bounds as `AnnotationElement[]`
- Area annotations stored with `areaRect` field — presence of this field distinguishes them from element/multi-select annotations
- Updated output.ts to format area annotation details: dimensions, position, and contained elements list
- AnnotationMarker.vue renders area annotations as dashed border rectangles (vs numbered badges for element annotations), with a small numbered badge in the top-left corner
- Dashed border color matches status (pending=blue, acknowledged=orange, resolved=green, dismissed=gray)
- Feedback modal header shows "Area selection (WxH)" for area annotations
- Typecheck passes clean; build succeeds
- Files changed: types.ts (areaRect field), output.ts (area formatting), VuePointToolbar.vue (Alt+drag handlers, area state, template, CSS), AnnotationMarker.vue (area marker rendering + CSS), prd.json, progress.md
- **Learnings for future iterations:**
  - Area annotations store `scrollX`/`scrollY` so the dashed border marker can convert viewport coords to page-absolute coords for correct positioning
  - Separate drag state pairs (`isDragging`/`dragRect` vs `isAreaDragging`/`areaDragRect`) keep multi-select and area selection independent
  - The `selectionRectStyle` computed can serve both drag types by checking which is active — avoids duplicating the rect-to-CSS logic
  - `handleDragStart` checks `e.altKey` before `e.shiftKey` isn't needed since they're checked with `||` — both keys trigger the handler, but the body distinguishes them
---

## 2026-03-04 - US-017
- Implemented text selection annotation: select text on page, click "Annotate Selection" in toolbar
- Added `selectedText` and `textSelectionRect` fields to `Annotation` and `AnnotationCreateInput` types
- Added `selectionchange` event listener to detect active text selections in the browser
- "Annotate Selection" button appears in toolbar (purple accent) when text is selected and not in annotate mode
- `captureTextSelection()` uses `window.getSelection()` + `Range.getBoundingClientRect()` to capture text and position
- Containing element resolved via `range.commonAncestorContainer` — its selector and component chain are captured
- AnnotationMarker.vue renders text annotations as semi-transparent purple highlights with bottom border and numbered badge
- Text highlight persists on the page at the original selection position (using stored scroll offsets for page-absolute coords)
- Updated output.ts to include `**Selected Text:** \`...\`` in Markdown output for text annotations
- Feedback modal header shows truncated selected text for context
- Typecheck passes clean; build succeeds
- Files changed: types.ts (selectedText + textSelectionRect fields), output.ts (text output), VuePointToolbar.vue (selection state + button + submit logic), AnnotationMarker.vue (text highlight marker + CSS), prd.json, progress.md
- **Learnings for future iterations:**
  - `document.addEventListener('selectionchange', ...)` fires on every selection change (including deselect) — check `sel.isCollapsed` to detect actual selections
  - `window.getSelection().getRangeAt(0).getBoundingClientRect()` returns the tightest rect around selected text — more precise than the containing element's rect
  - `range.commonAncestorContainer` is often a Text node — check `nodeType === Node.TEXT_NODE` and use `.parentElement` to get the containing Element
  - Text annotations use a distinct purple color (#7c3aed) to visually distinguish them from element (blue) and area (orange) annotation types
  - `sel.removeAllRanges()` clears the browser's text selection after capture to avoid visual confusion with the persistent highlight marker
---

## 2026-03-04 - US-018
- Added "Pause Animations" toggle button to the toolbar (between annotate and theme toggle)
- Injects a `<style data-vuepoint-pause>` element into `document.head` with `* { animation-play-state: paused !important; transition: none !important; }`
- Toggling off removes the style element, restoring original animation state
- Button shows pause icon (two bars) when animations are running, play icon (triangle) when paused
- Active state highlighted with amber (#f59e0b) border and icon color
- Style element cleaned up on component unmount via `removePauseStyle()`
- Typecheck passes clean
- Files changed: VuePointToolbar.vue (script: pause state + toggle + cleanup, template: pause button, styles: active state), prd.json, progress.md
- **Learnings for future iterations:**
  - Injecting a `<style>` element is better than setting `document.body.style` for animation pausing because it catches pseudo-elements, keyframe animations, and nested shadow DOM (with `!important`)
  - Use a `data-*` attribute on the injected style element for easy identification and cleanup
  - Storing the style element reference in a module-level `let` (not a `ref`) avoids unnecessary reactivity for DOM elements that don't need to trigger re-renders
---

## 2026-03-04 - US-019
- Added inline editing to AnnotationPanel.vue — double-click feedback text to enter edit mode
- Edit mode renders a `<textarea>` with the current feedback text, auto-focused and selected
- Save on blur or Enter (non-shift); cancel on Escape — uses `store.update(id, { feedback })` which auto-sets `updatedAt`
- Hover effect on feedback text hints at editability (subtle background highlight + `cursor: text`)
- Edit textarea styled to match panel theme (CSS vars for colors, accent border for focus indication)
- `@click.stop` on textarea and `@dblclick.stop` on feedback text prevent scroll-to-element from firing during editing
- Markdown output automatically reflects changes because `store.update()` mutates the reactive annotation array
- Typecheck passes clean
- Files changed: AnnotationPanel.vue (script: edit state + handlers, template: conditional textarea/text, styles: edit + hover), prd.json, progress.md
- **Learnings for future iterations:**
  - Vue's `ref` on a `v-if` element needs `nextTick` before accessing — the DOM element doesn't exist until the next render cycle
  - `@blur` fires before `@keydown` Enter in some browsers — saving on both is safe because `saveEdit()` is idempotent (clears `editingId` on first call)
  - `@click.stop` on the textarea prevents the parent `@click` (scroll-to-element) from firing during text editing
---

## 2026-03-04 - US-020
- Implemented agent question display in toolbar — full end-to-end flow from MCP agent to browser UI and back
- Added `agentQuestion`, `agentQuestionAt`, `agentQuestionReply`, `agentQuestionReplyAt` fields to `Annotation` type in core
- Updated bridge protocol: added `question_received` event (Worker → Tab) and `reply_question` command (Tab → Worker)
- Updated SharedWorker to handle `question_received` from API WebSocket (stores on annotation + broadcasts to tabs) and `reply_question` from tabs (stores reply + syncs to API)
- Updated API server: `POST /api/v1/annotations/:id/ask` now broadcasts `question_received` via WebSocket instead of being a stub; added `POST /api/v1/annotations/:id/reply` endpoint for browser replies
- Added `withUnansweredQuestions` computed and `replyToQuestion()` method to `useAnnotationsStore`
- Added pulsing amber question badge in toolbar (question mark icon + count) when unanswered questions exist
- AnnotationPanel shows agent questions inline with each annotation: amber-bordered question block with "Agent asks:" header, question text, reply button, reply textarea, and answered reply display
- Bridge client `replyQuestion()` method sends reply via SharedWorker → API
- Plugin.ts monkey-patches `replyToQuestion` for bridge sync (same `_bridgeSyncing` pattern as other mutations)
- MCP tool description updated to reference polling `agentQuestionReply` via `vuepoint_get_annotation`
- Typecheck passes clean; build succeeds
- Files changed: types.ts, bridge/types.ts, bridge/worker.ts, bridge/client.ts, api.ts, server.ts, useAnnotations.ts, VuePointToolbar.vue, AnnotationPanel.vue, plugin.ts, prd.json, progress.md
- **Learnings for future iterations:**
  - The bridge uses a dual-event pattern for questions: `annotation_updated` for data sync + `question_received` as a notification trigger — this avoids UI components needing to diff every update to detect new questions
  - The `reply` endpoint on the API is separate from `PATCH /annotations/:id` because the MCP agent's `vuepoint_ask` and the user's reply are conceptually different actors; using separate endpoints keeps authorization clearer
  - CSS `animation` (keyframes `vp-pulse`) on buttons creates visual urgency for unanswered questions without JavaScript polling
  - The question badge uses amber (#f59e0b) consistently across toolbar badge, panel question block border, reply button — semantic color for "needs attention"
---

## 2026-03-04 - US-021
- Implemented per-component Pinia store resolution in `useVueInspector.ts`
- `getComponentStores()` now accepts the DOM element (instead of the chain) and walks the Vue instance hierarchy inspecting `setupState` for Pinia store references
- Detection: checks each setupState value for `$id` property matching known Pinia store IDs
- Walks the full component chain (leaf → root) to catch stores used by ancestor components
- Falls back to all active store IDs if setupState inspection yields nothing (backward compatibility)
- Updated `VuePointToolbar.vue` to pass the element instead of the chain to `getComponentStores()`
- Added `setupState` to `VueInternalInstance` type definition
- Opt-in behavior preserved: only active when `VuePointOptions.pinia.enabled === true` and instance provided
- Typecheck passes clean; build succeeds
- Files changed: useVueInspector.ts (getComponentStores rewrite + setupState type), VuePointToolbar.vue (call site update), prd.json, progress.md
- **Learnings for future iterations:**
  - Pinia stores always have a `$id` property — this is the most reliable fingerprint for detecting store references in setupState
  - Vue 3 `setupState` is only available on component instances in dev builds (same as `__vueParentComponent`) — production guard already ensures VuePoint is never active in prod
  - Walking the full instance chain (not just the leaf) is important because parent components often fetch data via stores that children render
  - The fallback to all stores ensures no regression for edge cases (stores via provide/inject, global imports without binding)
---

## 2026-03-04 - US-022
- Implemented opt-in screenshot capture per annotation using html2canvas
- Added `screenshot?: { enabled: boolean }` to `VuePointOptions` in types.ts
- Installed `html2canvas` as a dependency of `@vuepoint/vue`
- `captureScreenshot()` in VuePointToolbar.vue uses html2canvas to render the annotated element as Base64 PNG
- html2canvas configured with: `useCORS: true`, Retina-aware scale, VuePoint UI excluded via `ignoreElements`
- `submitAnnotation()` made async to await screenshot capture; button shows "Capturing…" during capture
- Screenshot stored in annotation's `screenshot` field (already part of the type from initial design)
- AnnotationPanel.vue shows thumbnail (max-height 80px) with click-to-expand to full-size overlay
- REST API and webhook payloads automatically include screenshot via spread (no changes needed)
- Markdown output already supported screenshots via `includeScreenshot` option in output.ts
- Typecheck passes clean; build succeeds
- Files changed: types.ts (screenshot config), VuePointToolbar.vue (capture logic + async submit + UI), AnnotationPanel.vue (thumbnail + expanded view), packages/vue/package.json (+html2canvas), pnpm-lock.yaml, prd.json, progress.md
- **Learnings for future iterations:**
  - html2canvas's `ignoreElements` callback is essential for excluding VuePoint's own UI from screenshots
  - `submitAnnotation` became `async` — Vue event handlers can be async without issues, but the button should be disabled during capture to prevent double-submission
  - The `screenshot` field was pre-wired across types, store, and output formatter — a good example of interface-first design reducing implementation effort
  - Base64 PNG screenshots can be large (100KB+) — the opt-in design is important to avoid bloating WebSocket/webhook payloads
---

## 2026-03-04 - US-028
- Implemented webhook delivery log UI — settings panel in toolbar showing delivery history
- Added `WebhookDeliveryLog` type to `@vuepoint/core` (id, event, url, statusCode, success, timestamp, retryCount, error)
- API server: `deliverWebhookTracked()` logs every delivery attempt with status code and error; `logDelivery()` caps at 200 entries and broadcasts via WebSocket
- Added `GET /api/v1/webhooks/deliveries` endpoint for fetching log history
- Added `POST /api/v1/webhooks/retry` endpoint for retrying failed deliveries by delivery ID
- Bridge: added `webhook_delivery` event type to `BridgeEvent` union; SharedWorker forwards these from API WebSocket to all connected tabs
- Plugin.ts: listens for `webhook_delivery` bridge events and dispatches `vuepoint:webhook-delivery` custom DOM event to the isolated toolbar app
- VuePointToolbar: new `'settings'` UI mode with delivery log panel; `shallowRef<WebhookDeliveryLog[]>` holds recent deliveries (max 50 in UI)
- Each delivery entry shows: status dot (green/red), event type, HTTP status code, URL, timestamp, retry count badge
- Failed deliveries highlighted with red background; "Retry" button calls the retry endpoint
- Settings button (activity/pulse icon) in toolbar with red badge showing failed delivery count
- Typecheck passes clean
- Files changed: types.ts (WebhookDeliveryLog type), index.ts (export), api.ts (delivery tracking + endpoints), bridge/types.ts (event type), bridge/worker.ts (forwarding), plugin.ts (DOM event dispatch), VuePointToolbar.vue (settings panel + button + styles), prd.json, progress.md
- **Learnings for future iterations:**
  - The toolbar runs in an isolated Vue app — can't share reactive state via provide/inject with plugin.ts. Use DOM custom events (`document.dispatchEvent(new CustomEvent(...))`) to bridge the gap
  - `shallowRef` is better than `ref` for arrays that get replaced entirely (like delivery logs) — avoids deep reactivity overhead on objects that don't need individual property tracking
  - Delivery log should be capped both server-side (200) and UI-side (50) to prevent memory growth in long-running sessions
  - `deliverWebhookTracked` wraps the raw delivery function to separate concerns: the raw function returns status details, the tracked wrapper logs and broadcasts
---

## 2026-03-04 - US-029
- Implemented Nuxt 3 module (`@jumpcloud/nuxt-vuepoint`) in `packages/nuxt/`
- Created `module.ts` with `defineNuxtModule` — configKey `vuepoint`, production guard via `nuxt.options.dev === false`
- Created `runtime/plugin.ts` — Nuxt runtime plugin (`defineNuxtPlugin`) that installs VuePoint on `nuxtApp.vueApp`
- Module passes all options through `runtimeConfig.public.vuepoint` to the runtime plugin
- Plugin runs client-side only (`mode: 'client'`) with `enforce: 'post'` to ensure router/pinia install first
- Nuxt route metadata (layout, middleware) captured via VuePoint's existing context sync (Vue Router `afterEach` in plugin.ts)
- Production guard: module `setup()` early-returns when `nuxt.options.dev === false` unless `enabled: true` is explicitly set
- Build uses `nuxt-module-build` (standard Nuxt module tooling) — outputs `dist/module.mjs` + `dist/runtime/plugin.js`
- Root tsconfig excludes `packages/nuxt/src/runtime/**` since `#imports` is a Nuxt virtual module
- Typecheck passes clean; build succeeds
- Files changed: packages/nuxt/ (module.ts, runtime/plugin.ts, index.ts, package.json, tsconfig.json), tsconfig.json (exclude runtime), pnpm-lock.yaml, prd.json, progress.md
- **Learnings for future iterations:**
  - Nuxt runtime plugins use virtual module aliases (`#imports`, `#app`) that can't resolve outside Nuxt's build — exclude from root tsconfig
  - `defineNuxtModule` return type references `@nuxt/schema` — need explicit type annotation or `@nuxt/schema` devDep to avoid TS2742
  - `nuxt-module-build` is the standard build tool for Nuxt modules — handles both module code and runtime code separately
  - `enforce: 'post'` on the Nuxt plugin ensures VuePoint installs after router and Pinia plugins
  - Nuxt's `runtimeConfig.public` is the bridge between build-time module options and runtime plugin access
---

## 2026-03-04 - US-030
- Implemented VitePress documentation site in `docs/` directory
- Created 6 documentation pages: Getting Started, Configuration, MCP Integration, Webhooks, Nuxt Module, REST API Reference
- All pages include code examples for each integration method
- Added `docs:dev`, `docs:build`, `docs:preview` scripts to root package.json
- Installed `vitepress` as root devDependency
- `pnpm docs:build` builds successfully, `pnpm docs:dev` starts local dev server
- Files changed: `package.json`, `pnpm-lock.yaml`, `docs/` directory (8 new files)
- **Learnings for future iterations:**
  - VitePress config lives in `docs/.vitepress/config.ts` — uses `defineConfig` from `vitepress`
  - VitePress builds successfully even without all dependencies since docs are pure markdown
  - The `docs:dev` script is simply `vitepress dev docs` — no workspace filter needed since docs is not a package
  - Screenshot/GIF demos noted as acceptance criteria but require actual running app captures — placeholder text descriptions used instead
---

## 2026-03-04 - US-031
- Created dedicated "For PMs & Designers" guide page at `docs/guide/for-pms-and-designers.md`
- Step-by-step workflow: open staging URL → activate toolbar → annotate elements → copy output → paste to AI agent
- No terminal commands or code editor steps anywhere in the guide
- Created 5 SVG illustration diagrams in `docs/public/images/` showing: FAB button, expanded toolbar, element highlighting, feedback form, and annotation panel
- Added FAQ section covering 8 common questions (installation, production, browsers, mobile, missing button, agent feedback, multiplayer, status tracking)
- Included additional annotation modes section (multi-select, area select, text select)
- Added tips and best practices section for effective annotations
- Added page to VitePress sidebar between "Getting Started" and "Configuration"
- `pnpm typecheck` passes, `pnpm docs:build` succeeds
- Files changed: `docs/guide/for-pms-and-designers.md` (new), `docs/.vitepress/config.ts`, 5 SVG files in `docs/public/images/`, `prd.json`
- **Learnings for future iterations:**
  - VitePress serves files from `docs/public/` at the root path — images at `docs/public/images/foo.svg` are referenced as `/images/foo.svg` in markdown
  - SVG illustrations work well as documentation screenshots since they're lightweight, scalable, and version-control friendly
  - VitePress `::: tip` and `::: info` containers provide callout boxes for prerequisites and explanations
---

## 2026-03-04 - US-032
- Created GitHub Actions CI workflow at `.github/workflows/ci.yml`
- Steps: checkout → pnpm setup → Node setup → install → typecheck → lint → test
- Matrix: Node 18 and 20 on ubuntu-latest
- Runs on push to main and on all PRs
- Set up ESLint with flat config (`eslint.config.js`): typescript-eslint + eslint-plugin-vue/essential
- Set up Vitest with `vitest.config.ts` (passWithNoTests until US-033 adds tests)
- Added `lint` and `test` scripts to root `package.json`
- All quality checks pass: typecheck clean, lint 0 errors (3 warnings), test passes with no tests
- Files changed: `.github/workflows/ci.yml` (new), `eslint.config.js` (new), `vitest.config.ts` (new), `package.json`, `pnpm-lock.yaml`
- **Learnings for future iterations:**
  - `no-undef` should be turned off for TypeScript projects — TS handles undefined variables more accurately than ESLint
  - Use `flat/essential` instead of `flat/recommended` for eslint-plugin-vue to avoid opinionated template formatting that conflicts with existing code
  - `pnpm/action-setup@v4` auto-detects pnpm version from `packageManager` field in `package.json`
  - `passWithNoTests: true` in Vitest config lets CI pass before tests exist (US-033 will add them)
---

## 2026-03-04 - US-033
- Implemented unit tests for all core packages using Vitest
- **selector.ts** (20 tests): unique selector generation, max depth, ID priority, data-testid/data-cy anchors, class filtering (long/hash classes), nth-child fallback, special characters, describeElement for various element types
- **output.ts** (27 tests): single annotation format, batch format, optional field omission (expected/actual, Pinia stores, route, screenshot, props), multi-element details, area selection, ID header, empty batch
- **primevue-filter.ts** (8 tests): default list size validation, Vue builtins presence, buildFilter with false/undefined/custom array, deduplication
- **useAnnotations.ts** (21 tests): CRUD operations, status lifecycle (pending→acknowledged→resolved/dismissed), computed filters (pending/resolved/withUnansweredQuestions), replyToQuestion, clear
- Files created:
  - `packages/core/src/selector.test.ts`
  - `packages/core/src/output.test.ts`
  - `packages/core/src/primevue-filter.test.ts`
  - `packages/vue/src/composables/useAnnotations.test.ts`
- Files changed: `package.json` (added happy-dom devDep), `pnpm-lock.yaml`
- **Learnings for future iterations:**
  - Vitest environment can be set per-file with `@vitest-environment happy-dom` comment — no need to change global config
  - happy-dom is needed for DOM-based tests (selector.ts); Vue reactivity works out of the box with vitest
  - When testing `generateSelector`, the target element's selector must NOT be unique by itself — duplicate elements in DOM fixtures force the algorithm to climb the tree
  - Test files must be colocated with source files matching `packages/*/src/**/*.{test,spec}.ts` per vitest.config.ts
---

## 2026-03-04 - US-034
- Implemented Chrome browser extension (Manifest V3) in `packages/extension/`
- Files created:
  - `manifest.json` — MV3 manifest with permissions for storage, activeTab, scripting
  - `src/background.ts` — Service worker managing injection state, settings storage, and tab lifecycle
  - `src/content.ts` — Content script (ISOLATED world) that polls for Vue 3 apps via `__vue_app__` on root elements
  - `src/inject.ts` — Page-context script (MAIN world) that installs VuePoint toolbar onto detected Vue app
  - `src/popup/popup.html`, `popup.css`, `popup.ts` — Config UI for MCP port, API port, auth token, auto-inject toggle
  - `src/env.d.ts` — Vue SFC type shim for extension tsconfig
  - `vite.config.ts` — Multi-entry build (IIFE format, one entry per VITE_ENTRY env var)
  - `scripts/build.mjs` — Orchestrates four vite build passes + copies static assets
  - `icons/` — Generated PNG icons (16, 48, 128px)
- Modified `tsconfig.json` to exclude `packages/extension/**` from root typecheck (extension has its own tsconfig with `@types/chrome`)
- **Learnings for future iterations:**
  - Chrome extensions (MV3) need IIFE format bundles — Vite's lib mode with `formats: ['iife']` handles this
  - IIFE format doesn't support multiple entry points in a single build — use separate builds via env var
  - Extension content scripts run in ISOLATED world by default; use `chrome.scripting.executeScript` with `world: 'MAIN'` to access page JS context
  - VuePoint's toolbar runs as an isolated Vue app — bundling a separate Vue copy works fine since the toolbar doesn't share reactivity with the host app
  - `__vueParentComponent` on DOM elements is accessible regardless of which Vue runtime copy reads it
  - Packages with Chrome-specific types (`@types/chrome`) should be excluded from root tsconfig to avoid polluting other packages' type environments
---

## 2026-03-04 - US-035
- Created `toSlackMessage()` transformer in `packages/core/src/slack-transformer.ts`
- Transforms VuePoint `WebhookPayload` into Slack Block Kit format with: status emoji, element/selector fields, component chain, expected/actual, Pinia stores, screenshot thumbnail, resolution summary, "View in VuePoint" link
- Exported `toSlackMessage`, `SlackMessage`, `SlackBlock`, `SlackTextObject`, `SlackTransformerOptions` from `@vuepoint/core`
- Created dedicated docs page `docs/guide/slack-webhook.md` with relay server example, transformer API reference, and event filtering guide
- Added Slack integration section to existing `docs/guide/webhooks.md`
- Added sidebar entry in VitePress config
- Files changed: `packages/core/src/slack-transformer.ts` (new), `packages/core/src/index.ts`, `docs/guide/slack-webhook.md` (new), `docs/guide/webhooks.md`, `docs/.vitepress/config.ts`
- **Learnings for future iterations:**
  - Slack incoming webhooks accept Block Kit JSON directly — no SDK needed, just POST with `Content-Type: application/json`
  - Slack mrkdwn is different from standard Markdown — `<`, `>`, `&` must be escaped as HTML entities
  - The transformer pattern (pure function, no side effects) is reusable for Linear/Jira templates (US-036)
  - Pre-existing lint errors in `selector.test.ts` and `output.test.ts` are unrelated to new code
---

## 2026-03-04 - US-036
- Implemented Linear payload transformer (`toLinearIssue()`) in `packages/core/src/linear-transformer.ts`
- Implemented Jira payload transformer (`toJiraIssue()`) in `packages/core/src/jira-transformer.ts` using Atlassian Document Format (ADF)
- Both transformers follow the same pure-function pattern as the Slack transformer
- Issue title derived from first sentence of feedback (max 80 chars)
- Labels auto-applied: `vuepoint`, `ui-feedback` by default
- Exported types and functions from `packages/core/src/index.ts`
- Added documentation: `docs/guide/linear-webhook.md` and `docs/guide/jira-webhook.md`
- Updated `docs/guide/webhooks.md` with integration templates section referencing all three
- Updated VitePress sidebar config with new pages
- Files changed:
  - `packages/core/src/linear-transformer.ts` (new)
  - `packages/core/src/jira-transformer.ts` (new)
  - `packages/core/src/index.ts` (modified)
  - `docs/guide/linear-webhook.md` (new)
  - `docs/guide/jira-webhook.md` (new)
  - `docs/guide/webhooks.md` (modified)
  - `docs/.vitepress/config.ts` (modified)
- **Learnings for future iterations:**
  - Jira uses Atlassian Document Format (ADF) — a structured JSON format, NOT Markdown
  - Linear API accepts Markdown descriptions — simpler than Jira
  - Follow the Slack transformer pattern: pure function, typed options, typed output
  - Export pattern: types with `type` keyword, functions directly from `index.ts`
---

## 2026-03-04 - US-037
- Created team annotation dashboard as a standalone Vue 3 app in `packages/dashboard/`
- Dashboard connects to API server's REST endpoints (`http://localhost:3742/api/v1/`) and WebSocket (`ws://localhost:3742/ws`) for real-time updates
- Features implemented:
  - Real-time annotation list with WebSocket push updates (create, update, remove, clear events)
  - Filters by status (pending/acknowledged/resolved/dismissed), route, and text search
  - Stats bar showing counts per status
  - Detail panel with full annotation info (feedback, expected/actual, selector, component chain, SFC path, route, Pinia stores)
  - Timeline history showing created/acknowledged/agent questions/resolved/dismissed events with timestamps
  - CSV and Markdown export via API's `/api/v1/annotations/export` endpoint
  - App context display (current route and page component)
  - Auto-reconnect WebSocket with 5s backoff
- Files created: `packages/dashboard/` (package.json, tsconfig.json, vite.config.ts, index.html, src/main.ts, src/App.vue, src/useApiClient.ts, src/env.d.ts)
- Files modified: root package.json (added `dev:dashboard` script), root tsconfig.json (added dashboard includes), pnpm-lock.yaml
- **Learnings for future iterations:**
  - Dashboard connects directly to the API server (port 3742), not through SharedWorker — the API already exposes all needed endpoints including WebSocket
  - API WebSocket events match BridgeEvent types: annotation_created, annotation_updated, annotation_removed, annotations_cleared, context_updated
  - The export endpoint accepts `format` query param (json/markdown/csv) and `status` filter
  - Dashboard is at port 3743 to avoid conflicts with API (3742) and bridge (3741)
---

## 2026-03-04 - US-038
- Created `vite-plugin-vuepoint` package in `packages/vite-plugin/`
- Vite plugin auto-injects `app.use(VuePoint)` into Vue 3 entry files without modifying main.ts
- Uses Vite `transform` hook to detect `createApp()` calls and inject VuePoint before `.mount()`
- `apply: 'serve'` ensures plugin only runs in dev mode (production guard)
- Configurable entry pattern (defaults to `/main|entry|app/` files) and VuePointOptions pass-through
- Files created: `packages/vite-plugin/package.json`, `packages/vite-plugin/tsconfig.json`, `packages/vite-plugin/vite.config.ts`, `packages/vite-plugin/src/index.ts`
- Files modified: `.chief/prds/main/prd.json` (US-038 passes: true)
- **Learnings for future iterations:**
  - `VuePointOptions` is exported from `@vuepoint/core`, not `@vuepoint/vue`
  - Vite plugin `apply: 'serve'` is the cleanest production guard — avoids injecting in build mode entirely
  - The `transform` hook with regex is simpler than AST parsing for this use case — `createApp` pattern is reliable
  - `packages/*/src/**/*.ts` glob in root tsconfig already covers new packages — no tsconfig changes needed
---
