# PRD: VuePoint — Visual Annotation & AI Agent Feedback Tool for Vue 3

## Introduction

VuePoint is an internal JumpCloud tool that adds a visual annotation toolbar to live Vue 3 applications. Engineers, designers, and PMs can point at UI elements and generate structured, machine-readable feedback (CSS selectors, Vue component hierarchies, SFC file paths) that AI coding agents can act on directly. Instead of describing "the blue button on the left," users hand an agent a precise selector and component chain, cutting feedback loops from minutes to seconds.

VuePoint is inspired by Agentation (a React tool) but built from scratch for Vue 3, with enhancements: Vue component hierarchy resolution via `__vueParentComponent`, Pinia store context, SFC file paths, a REST API, webhooks, and Nuxt 3 support.

**Current state:** 11 source files exist as flat files in the repo root. The monorepo structure described in architecture docs has not been scaffolded. Core annotation logic works in isolation, but the browser-to-server bridge (SharedWorker) is unbuilt, making MCP and REST API non-functional end-to-end.

---

## Goals

- **G1:** Resolve Vue 3 component names and SFC file paths when annotating any DOM element
- **G2:** Zero-config install for non-engineers — `app.use(VuePoint)` and go
- **G3:** Match Agentation v2.0 feature parity (click, multi-select, area, text selection, animation pause, MCP)
- **G4:** Add Vue-specific enhancements: Pinia store context, SFC paths, PrimeVue filtering
- **G5:** Provide integration surface: MCP server, REST API, webhooks — all working end-to-end
- **G6:** Support Nuxt 3 via dedicated module
- **G7:** Auto-disable in production with zero runtime overhead

---

## User Stories

### US-001: Scaffold monorepo directory structure
**Priority:** 1
**Description:** As a developer, I need the project organized as a pnpm monorepo so that cross-package imports resolve and the project can be built, tested, and published.

**Acceptance Criteria:**
- [ ] Directory structure created: `packages/core/`, `packages/vue/`, `packages/bridge/`, `packages/mcp/`, `packages/api/`, `packages/nuxt/`, `playground/`
- [ ] Existing 11 source files moved to their correct package locations per architecture spec
- [ ] Root `package.json` with pnpm workspaces configuration
- [ ] Per-package `package.json` with correct `name`, `exports`, `dependencies`, and `peerDependencies`
- [ ] Root `tsconfig.json` and per-package `tsconfig.json` with project references
- [ ] `pnpm install` succeeds without errors
- [ ] Cross-package imports (`@vuepoint/core` from `@vuepoint/vue`) resolve correctly in TypeScript

---

### US-002: Build system with Vite
**Priority:** 1
**Description:** As a developer, I need each package to build via Vite so that the project produces consumable ESM + CJS output.

**Acceptance Criteria:**
- [ ] `vite.config.ts` in each publishable package (`core`, `vue`, `mcp`, `api`)
- [ ] `pnpm build` from root builds all packages in dependency order
- [ ] `@vuepoint/core` outputs ESM + CJS with TypeScript declarations
- [ ] `@vuepoint/vue` outputs ESM + CJS with TypeScript declarations and `.vue` SFC compilation
- [ ] `@vuepoint/mcp` outputs a runnable Node.js entry point
- [ ] `@vuepoint/api` outputs a runnable Node.js entry point
- [ ] `pnpm typecheck` passes across all packages

---

### US-003: Vue component hierarchy resolution
**Priority:** 1
**Description:** As a developer using an AI agent, I want annotations to include the full Vue component chain and SFC file path so the agent can navigate directly to the source file.

**Acceptance Criteria:**
- [ ] `useVueInspector.ts` walks `__vueParentComponent` from clicked element to app root
- [ ] Component names resolved from `__name`, `name`, or `__file` fallback
- [ ] SFC file path extracted from `component.type.__file` and normalized (strips absolute prefix)
- [ ] Vue built-in components (`Transition`, `KeepAlive`, etc.) filtered out
- [ ] Chain returned in root-to-leaf order: `<App> -> <PageView> -> <TargetComponent>`
- [ ] Typecheck passes

*Note: This file exists and is complete (`useVueInspector.ts`). Story included for reference.*

---

### US-004: CSS selector generation
**Priority:** 1
**Description:** As a developer using an AI agent, I want each annotation to include a unique CSS selector so the agent can grep for or target the exact element.

**Acceptance Criteria:**
- [ ] `generateSelector()` produces a unique CSS path from root to target element
- [ ] Prioritizes: `#id` > `[data-testid]` > tag + classes > `:nth-child()`
- [ ] Max depth of 8 to keep selectors readable
- [ ] `describeElement()` returns a human-readable summary (tag, classes, text content)
- [ ] Typecheck passes

*Note: This file exists and is complete (`selector.ts`). Story included for reference.*

---

### US-005: Markdown output formatter
**Priority:** 1
**Description:** As a user, I want annotations formatted as structured Markdown so I can paste them into any AI agent chat.

**Acceptance Criteria:**
- [ ] `formatAnnotation()` outputs Markdown with: Element, Selector, Component chain, SFC Path, Pinia Stores, Feedback, Expected, Actual, Route
- [ ] `formatAnnotationBatch()` formats multiple annotations with numbered headers
- [ ] Optional fields (Expected, Actual, Pinia Stores) omitted when empty
- [ ] Output is greppable and machine-parseable
- [ ] Typecheck passes

*Note: This file exists and is complete (`output.ts`). Story included for reference.*

---

### US-006: PrimeVue component filtering
**Priority:** 1
**Description:** As a developer using PrimeVue, I want library-internal components filtered from the hierarchy so annotations show only my own components.

**Acceptance Criteria:**
- [ ] Default filter list covers 35+ PrimeVue internal components (`PButton`, `PDialog`, etc.)
- [ ] Vue built-in components (`Transition`, `KeepAlive`, `Suspense`, etc.) always filtered
- [ ] `buildFilter()` accepts: `false` (no filtering), `string[]` (custom list), or `undefined` (defaults)
- [ ] Filter is configurable via `VuePointOptions.filterComponents`
- [ ] Typecheck passes

*Note: This file exists and is complete (`primevue-filter.ts`). Story included for reference.*

---

### US-007: Annotation state management
**Priority:** 1
**Description:** As a developer, I need a reactive annotation store so the toolbar, markers, and integrations all share the same state.

**Acceptance Criteria:**
- [ ] `useAnnotations()` composable provides reactive `annotations` array and `pending`/`resolved` computed filters
- [ ] CRUD operations: `create`, `update`, `acknowledge`, `resolve`, `dismiss`, `remove`, `clear`
- [ ] Each annotation gets a unique ID and timestamp on creation
- [ ] Status lifecycle: `pending` -> `acknowledged` -> `resolved` | `dismissed`
- [ ] Store is framework-agnostic (plain Vue `ref`/`computed`, not Pinia)
- [ ] Typecheck passes

*Note: This file exists and is complete (`useAnnotations.ts`). Story included for reference.*

---

### US-008: Vue plugin entry with production guard
**Priority:** 1
**Description:** As a developer, I want to install VuePoint with `app.use(VuePoint)` and have it auto-disable in production.

**Acceptance Criteria:**
- [ ] `app.use(VuePoint)` installs the toolbar with zero config
- [ ] `app.use(VuePoint, { ...options })` accepts full `VuePointOptions`
- [ ] Production guard: disabled when `NODE_ENV === 'production'` or `import.meta.env.PROD === true`
- [ ] Toolbar rendered in an isolated Vue app instance (separate from host app — does not appear in `__vueParentComponent` chain)
- [ ] Keyboard shortcut parsed and registered (default: `Ctrl+Shift+A`)
- [ ] Typecheck passes

*Note: This file exists and is complete (`plugin.ts`). Story included for reference.*

---

### US-009: Core toolbar — click-to-annotate flow
**Priority:** 1
**Description:** As a user, I want to click any element in my app and create an annotation with structured feedback.

**Acceptance Criteria:**
- [ ] FAB button (collapsed by default) expands toolbar on click
- [ ] Activating "annotate mode" changes cursor and highlights elements on hover
- [ ] Clicking an element captures: selector, component chain, SFC path, bounding rect
- [ ] Feedback modal appears with text input for user's description
- [ ] Submitting creates an annotation in the store
- [ ] Annotation marker (numbered badge) placed at the annotated element's position
- [ ] "Copy All" button generates Markdown output to clipboard
- [ ] Keyboard shortcut toggles toolbar visibility
- [ ] Typecheck passes

*Note: `VuePointToolbar.vue` exists with core flow. `AnnotationMarker.vue` and `AnnotationPanel.vue` are imported but do not exist yet — they must be created.*

---

### US-010: Create AnnotationMarker component
**Priority:** 1
**Description:** As a user, I want to see numbered badges on annotated elements so I can visually track which elements have feedback.

**Acceptance Criteria:**
- [ ] `AnnotationMarker.vue` renders a positioned numbered badge at each annotation's bounding rect
- [ ] Badge updates position on scroll and resize
- [ ] Clicking a badge selects that annotation in the panel
- [ ] Badge color reflects annotation status (pending = blue, acknowledged = orange, resolved = green)
- [ ] Typecheck passes

---

### US-011: Create AnnotationPanel component
**Priority:** 1
**Description:** As a user, I want a panel listing all annotations so I can review, edit, and manage them.

**Acceptance Criteria:**
- [ ] `AnnotationPanel.vue` renders a scrollable list of all annotations
- [ ] Each item shows: number, element description, feedback text, status badge
- [ ] Delete button removes an annotation
- [ ] Clicking an item scrolls the page to the annotated element
- [ ] Empty state message when no annotations exist
- [ ] Typecheck passes

---

### US-012: Expected/Actual fields in feedback form
**Priority:** 2
**Description:** As a user reporting a bug, I want to specify what I expected and what actually happened, so the AI agent has clear context.

**Acceptance Criteria:**
- [ ] Feedback modal includes optional "Expected behavior" and "Actual behavior" text fields
- [ ] Fields are collapsible (hidden by default, expand on click)
- [ ] Values saved to annotation's `expected` and `actual` fields
- [ ] Included in Markdown output when present
- [ ] Typecheck passes

---

### US-013: Dark/light mode toggle
**Priority:** 2
**Description:** As a user, I want the toolbar to support dark and light themes so it matches my app's appearance.

**Acceptance Criteria:**
- [ ] Toggle switch in toolbar header
- [ ] All toolbar components (FAB, panel, markers, modal) respect the theme
- [ ] Default theme auto-detected from `prefers-color-scheme` media query
- [ ] Theme preference persisted in `localStorage`
- [ ] Typecheck passes

---

### US-014: Playground development app
**Priority:** 2
**Description:** As a developer, I need a test app to develop and demo VuePoint in a realistic Vue 3 + PrimeVue environment.

**Acceptance Criteria:**
- [ ] `playground/` directory with a Vue 3 + Vite app
- [ ] PrimeVue installed and configured with sample components (DataTable, Button, Dialog, etc.)
- [ ] VuePoint installed via workspace link (`@vuepoint/vue`)
- [ ] Pinia store with sample data (e.g., a users list)
- [ ] Multiple routes to test route context capture
- [ ] `pnpm dev` starts the playground with hot reload
- [ ] Typecheck passes

---

### US-015: Multi-select annotation (drag)
**Priority:** 3
**Description:** As a user, I want to drag-select multiple elements at once so I can annotate a group of related elements in one action.

**Acceptance Criteria:**
- [ ] Hold Shift + drag to draw a selection rectangle
- [ ] All elements intersecting the rectangle are captured as a single multi-element annotation
- [ ] Each element's selector and component info included in the annotation
- [ ] Visual feedback during drag (selection rectangle overlay)
- [ ] Typecheck passes

---

### US-016: Area selection annotation
**Priority:** 3
**Description:** As a user, I want to select an arbitrary rectangular area of the page to annotate layout or spacing issues that don't map to a single element.

**Acceptance Criteria:**
- [ ] Alt + drag to draw an area selection
- [ ] Area annotation captures: bounding rect coordinates, screenshot of area (Phase 2), elements within bounds
- [ ] Distinct visual marker for area annotations (dashed border vs. badge)
- [ ] Typecheck passes

---

### US-017: Text selection annotation
**Priority:** 3
**Description:** As a user, I want to select text on the page and annotate it to flag copy issues, typos, or content feedback.

**Acceptance Criteria:**
- [ ] Select text, then click "Annotate Selection" in toolbar (or right-click context)
- [ ] Annotation captures: selected text, containing element selector, component chain
- [ ] Text highlight marker persists on the page
- [ ] Typecheck passes

---

### US-018: Animation pause
**Priority:** 3
**Description:** As a user, I want to pause all CSS animations and transitions so I can annotate elements that are in motion.

**Acceptance Criteria:**
- [ ] "Pause Animations" toggle in toolbar
- [ ] Injects `* { animation-play-state: paused !important; transition: none !important; }` globally
- [ ] Removing toggle restores original animation state
- [ ] Typecheck passes

---

### US-019: Inline editing in annotation panel
**Priority:** 3
**Description:** As a user, I want to edit annotation feedback directly in the panel without reopening a modal.

**Acceptance Criteria:**
- [ ] Double-click feedback text in panel to switch to inline edit mode
- [ ] Save on blur or Enter; cancel on Escape
- [ ] Updated text reflected in Markdown output immediately
- [ ] Typecheck passes

---

### US-020: Agent question display in toolbar
**Priority:** 3
**Description:** As a user, I want to see and answer questions from AI agents directly in the toolbar when an agent calls `vuepoint_ask`.

**Acceptance Criteria:**
- [ ] When MCP agent calls `vuepoint_ask`, question appears as a notification badge on the toolbar
- [ ] Opening toolbar shows the question with a text reply field
- [ ] User's reply sent back through the bridge to the MCP server
- [ ] Question/answer history visible in annotation panel
- [ ] Typecheck passes

---

### US-021: Per-component Pinia store resolution
**Priority:** 3
**Description:** As a developer, I want annotations to show which Pinia stores a specific component accesses, not just all stores in the app.

**Acceptance Criteria:**
- [ ] `useVueInspector` resolves which stores a component's setup function references
- [ ] Store IDs listed in annotation output under "Pinia Stores"
- [ ] Opt-in: only active when `VuePointOptions.pinia.enabled === true` and Pinia instance provided
- [ ] Typecheck passes

---

### US-022: Screenshot capture per annotation
**Priority:** 3
**Description:** As a user, I want a screenshot of the annotated element automatically attached so async reviewers can see the visual context.

**Acceptance Criteria:**
- [ ] Screenshot captured via `html2canvas` or Screen Capture API when annotation is created
- [ ] Stored as Base64 PNG in annotation's `screenshot` field
- [ ] Thumbnail visible in annotation panel
- [ ] Included in REST API and webhook payloads
- [ ] Opt-in configuration (not captured by default to avoid performance overhead)
- [ ] Typecheck passes

---

### US-023: SharedWorker bridge — browser to Node state sync
**Priority:** 2
**Description:** As a developer, I need a SharedWorker that holds annotation state and exposes it via HTTP/WebSocket so the MCP server and REST API can read and write annotations from the browser.

**Acceptance Criteria:**
- [ ] `packages/bridge/src/worker.ts` implements a SharedWorker
- [ ] Worker receives annotation events from `VuePointToolbar.vue` via `postMessage`
- [ ] Worker exposes HTTP endpoints on `localhost:3741` mirroring the REST API shape (GET/POST/PATCH/DELETE annotations)
- [ ] Worker exposes WebSocket on `ws://localhost:3741/ws` for real-time push
- [ ] Multiple browser tabs share the same worker instance and annotation state
- [ ] MCP server (`server.ts`) can successfully `fetch()` annotations from the worker
- [ ] REST API (`api.ts`) can successfully read/write annotations via the worker
- [ ] Typecheck passes

---

### US-024: Context sync — browser pushes route/component to bridge
**Priority:** 2
**Description:** As an AI agent, I want `vuepoint_get_app_context` to return the current route, page component, and active Pinia stores so I can understand what the user is looking at.

**Acceptance Criteria:**
- [ ] `plugin.ts` sends context updates to the SharedWorker on route change
- [ ] Context includes: current route path, route name, matched page component name, active Pinia store IDs
- [ ] MCP tool `vuepoint_get_app_context` returns this context via the bridge
- [ ] REST endpoint `GET /api/v1/context` returns this context
- [ ] Typecheck passes

---

### US-025: MCP server — all 8 tools functional end-to-end
**Priority:** 2
**Description:** As an AI agent (Claude Code, Cursor), I want to use MCP tools to read, acknowledge, and resolve annotations in real time.

**Acceptance Criteria:**
- [ ] `npx vuepoint mcp` starts the stdio MCP server
- [ ] `vuepoint_get_annotations` returns all pending annotations from the browser
- [ ] `vuepoint_get_annotation` returns a single annotation by ID
- [ ] `vuepoint_acknowledge` marks an annotation as in-progress (toolbar badge updates)
- [ ] `vuepoint_resolve` marks as resolved with summary (annotation removed from pending, webhook fired)
- [ ] `vuepoint_dismiss` archives with reason
- [ ] `vuepoint_ask` sends question to toolbar; user's reply returned to agent
- [ ] `vuepoint_get_component_info` queries live DOM via bridge and returns component details
- [ ] `vuepoint_get_app_context` returns current route, page, and stores
- [ ] All tools validated with Zod schemas
- [ ] Typecheck passes

*Note: `server.ts` code exists and is complete. This story is blocked by US-023 (bridge).*

---

### US-026: REST API — full CRUD + export + webhooks
**Priority:** 2
**Description:** As a developer or external tool, I want HTTP endpoints to manage annotations programmatically.

**Acceptance Criteria:**
- [ ] Fastify server starts on configurable port (default 3742)
- [ ] `GET /api/v1/annotations` lists annotations with `?status=` filter
- [ ] `GET /api/v1/annotations/:id` returns single annotation
- [ ] `POST /api/v1/annotations` creates annotation programmatically
- [ ] `PATCH /api/v1/annotations/:id` updates status/notes
- [ ] `DELETE /api/v1/annotations/:id` hard deletes
- [ ] `GET /api/v1/annotations/export` exports as Markdown, JSON, or CSV
- [ ] `GET /api/v1/component` queries component by selector or name
- [ ] `GET /api/v1/context` returns current app context
- [ ] `GET /api/v1/health` returns health check
- [ ] Optional bearer token auth
- [ ] Configurable CORS
- [ ] Typecheck passes

*Note: `api.ts` code exists and is complete. This story is blocked by US-023 (bridge) for browser-connected operation.*

---

### US-027: Webhook engine with HMAC signing and retry
**Priority:** 2
**Description:** As a team, I want annotations pushed to external URLs (Slack, Linear, etc.) automatically when events occur.

**Acceptance Criteria:**
- [ ] Webhooks configurable via `VuePointOptions.webhooks[]`
- [ ] Events supported: `annotation.created`, `annotation.updated`, `annotation.acknowledged`, `annotation.resolved`, `annotation.dismissed`, `annotation.batch_copied`, `session.started`, `session.ended`
- [ ] Payload signed with HMAC-SHA256; signature in `X-VuePoint-Signature-256` header
- [ ] Retry: 3 attempts with exponential backoff (1s -> 5s -> 30s)
- [ ] `POST /api/v1/webhooks/test` triggers test delivery
- [ ] `GET /api/v1/webhooks` lists configured webhooks
- [ ] Typecheck passes

*Note: Webhook engine exists in `api.ts` and is complete.*

---

### US-028: Webhook delivery log UI
**Priority:** 3
**Description:** As a user, I want to see webhook delivery status in the toolbar settings so I can debug failed deliveries.

**Acceptance Criteria:**
- [ ] Settings panel in toolbar shows webhook delivery history
- [ ] Each entry shows: event type, URL, status code, timestamp, retry count
- [ ] Failed deliveries highlighted in red
- [ ] "Retry" button for failed deliveries
- [ ] Typecheck passes

---

### US-029: Nuxt 3 module
**Priority:** 4
**Description:** As a Nuxt 3 developer, I want a dedicated module so VuePoint integrates with Nuxt's auto-import and route system.

**Acceptance Criteria:**
- [ ] `@jumpcloud/nuxt-vuepoint` package in `packages/nuxt/`
- [ ] Install via `modules: ['@jumpcloud/nuxt-vuepoint']` in `nuxt.config.ts`
- [ ] Auto-registers VuePoint plugin with Nuxt's Vue app
- [ ] Captures Nuxt route metadata (layout, middleware) in context
- [ ] Respects `vuepoint: { enabled }` config in `nuxt.config.ts`
- [ ] Production guard works with Nuxt's build system
- [ ] Typecheck passes

---

### US-030: Documentation site
**Priority:** 4
**Description:** As a JumpCloud team member, I need a documentation site so I can learn how to install and use VuePoint.

**Acceptance Criteria:**
- [ ] VitePress site in `docs/` directory
- [ ] Pages: Getting Started, Configuration, MCP Integration, REST API Reference, Webhooks, Nuxt Module
- [ ] Code examples for each integration method
- [ ] Screenshot/GIF demos of annotation workflow
- [ ] `pnpm docs:dev` starts local dev server

---

### US-031: Non-technical install guide
**Priority:** 4
**Description:** As a PM or designer, I need a simple guide so I can start annotating without developer help.

**Acceptance Criteria:**
- [ ] Dedicated "For PMs & Designers" page in docs
- [ ] Step-by-step: open staging URL, activate toolbar, annotate, copy output, paste to agent
- [ ] No terminal or code editor steps required
- [ ] Screenshots for each step
- [ ] FAQ section addressing common questions

---

### US-032: CI pipeline
**Priority:** 4
**Description:** As a developer, I need CI to run typecheck, lint, and tests on every PR.

**Acceptance Criteria:**
- [ ] GitHub Actions workflow in `.github/workflows/ci.yml`
- [ ] Steps: install, typecheck, lint (ESLint), test (Vitest)
- [ ] Runs on push to `main` and on all PRs
- [ ] Matrix: Node 18, 20
- [ ] Status checks required for merge

---

### US-033: Unit tests for core packages
**Priority:** 4
**Description:** As a developer, I need unit tests for selector generation, output formatting, and annotation state management.

**Acceptance Criteria:**
- [ ] Vitest configured at monorepo root
- [ ] Tests for `selector.ts`: unique selector generation, max depth, ID priority, special characters
- [ ] Tests for `output.ts`: single annotation format, batch format, optional field omission
- [ ] Tests for `primevue-filter.ts`: default list, custom list, disabled filtering
- [ ] Tests for `useAnnotations.ts`: CRUD operations, status lifecycle, computed filters
- [ ] All tests pass with `pnpm test`

---

### US-034: Browser extension (no-install)
**Priority:** 5
**Description:** As a PM, I want a browser extension that injects VuePoint into any Vue 3 staging URL so I don't need developer help to install the package.

**Acceptance Criteria:**
- [ ] Chrome extension that detects Vue 3 apps via `__vue_app__` on `#app`
- [ ] Injects VuePoint toolbar into the page
- [ ] Extension popup allows configuring MCP port and auth token
- [ ] Works on any Vue 3 app without code changes
- [ ] Published to JumpCloud internal Chrome Web Store

---

### US-035: Slack webhook template
**Priority:** 5
**Description:** As a team, I want annotations automatically posted to a Slack channel with rich formatting.

**Acceptance Criteria:**
- [ ] Pre-built webhook payload transformer for Slack Block Kit format
- [ ] Annotation appears as Slack message with: element description, selector, component chain, feedback, status badge
- [ ] Screenshot thumbnail attached when available
- [ ] "View in VuePoint" link (when web dashboard exists)
- [ ] Configuration example in docs

---

### US-036: Linear/Jira webhook templates
**Priority:** 5
**Description:** As a team, I want annotations to create issues in Linear or Jira automatically.

**Acceptance Criteria:**
- [ ] Pre-built payload transformers for Linear and Jira webhook formats
- [ ] Issue title derived from annotation feedback (first sentence)
- [ ] Issue body includes full structured annotation output
- [ ] Labels/tags auto-applied (e.g., "vuepoint", "ui-feedback")
- [ ] Configuration examples in docs

---

### US-037: Team annotation dashboard
**Priority:** 5
**Description:** As an engineering manager, I want a shared live dashboard showing all team annotations in real time.

**Acceptance Criteria:**
- [ ] Web dashboard (separate Vue app or VitePress page)
- [ ] Real-time updates via WebSocket connection to bridge
- [ ] Shows all annotations across team members with filters (status, user, route)
- [ ] Annotation history with timestamps and resolution summaries
- [ ] Exportable as CSV or Markdown

---

### US-038: Vite plugin (zero-config)
**Priority:** 5
**Description:** As a developer, I want a Vite plugin that auto-injects VuePoint without modifying `main.ts`.

**Acceptance Criteria:**
- [ ] `vite-plugin-vuepoint` package
- [ ] Add to `vite.config.ts` plugins array — no `main.ts` changes needed
- [ ] Auto-detects Vue app entry and injects `app.use(VuePoint)`
- [ ] Respects `mode` for production guard
- [ ] Typecheck passes

---

## Functional Requirements

- FR-1: The system must resolve Vue 3 component hierarchies by walking `__vueParentComponent` from any DOM element to the app root
- FR-2: The system must extract SFC file paths from `component.type.__file` and normalize them to project-relative paths
- FR-3: The system must generate unique CSS selectors for any annotated DOM element, prioritizing `#id` > `[data-testid]` > classes > `:nth-child()`
- FR-4: The system must format annotations as structured Markdown with: Selector, Component Chain, SFC Path, Pinia Stores, Feedback, Expected, Actual
- FR-5: The system must filter PrimeVue and Vue built-in components from the hierarchy by default, with configurable filter lists
- FR-6: The system must render an isolated toolbar overlay that does not appear in the host app's Vue component tree
- FR-7: The system must auto-disable all functionality when `NODE_ENV === 'production'`
- FR-8: The system must sync annotation state between browser tabs via SharedWorker
- FR-9: The system must expose annotations to AI agents via MCP server (stdio + HTTP SSE transports)
- FR-10: The system must expose annotations via REST API with full CRUD, export (Markdown/JSON/CSV), and bearer token auth
- FR-11: The system must fire webhooks on annotation lifecycle events with HMAC-SHA256 signed payloads and exponential-backoff retry
- FR-12: The system must support keyboard shortcut toggle (default `Ctrl+Shift+A`, configurable)
- FR-13: The system must persist theme preference (dark/light) in `localStorage`
- FR-14: The system must support Nuxt 3 via a dedicated module that auto-registers the plugin and captures Nuxt route metadata

---

## Non-Goals

- **Not a code generator** — VuePoint provides context to agents; it does not generate or modify code itself
- **Not React-compatible** — intentionally Vue 3 only
- **Not a visual design tool** — no Figma-like canvas, drag-and-drop UI builder, or code generation
- **Not a full error tracking platform** — no Sentry-like error capture, performance monitoring, or alerting
- **Not a public npm package** — internal JumpCloud distribution only
- **No Vue 2 support** — JumpCloud is Vue 3 only; Vue 2 reached EOL January 2024
- **No persistent database** — annotation state is ephemeral (in-memory/SharedWorker), not stored in SQLite/Redis
- **No user authentication system** — optional bearer token for API access, but no user accounts or RBAC

---

## Design Considerations

- **Toolbar UX:** Collapsed FAB by default, never obstructing content. Expands to show annotation controls, list panel, and settings. Cursor changes to crosshair in annotate mode with subtle hover highlight.
- **Isolated rendering:** Toolbar is its own Vue app instance mounted in a separate DOM container. This prevents VuePoint components from appearing in the host app's component tree (important: annotations should show the *user's* components, not VuePoint's).
- **Marker positioning:** Numbered badges positioned absolutely relative to viewport, updated on scroll/resize via `IntersectionObserver` or `scroll`/`resize` event listeners.
- **Theme:** Auto-detect `prefers-color-scheme`, manual toggle, persist in `localStorage`. All VuePoint styles scoped to avoid host app conflicts.
- **Responsive:** Toolbar and panel adapt to viewport width. On mobile-width viewports, panel renders as bottom sheet instead of sidebar.

---

## Technical Considerations

- **`__vueParentComponent` availability:** Only present in Vue 3 development builds. VuePoint's component resolution gracefully degrades in production builds (returns empty hierarchy). This aligns with the production guard — VuePoint is disabled in prod anyway.
- **SharedWorker browser support:** SharedWorker is supported in Chrome, Edge, Firefox. Safari support is limited (added in Safari 16). For Safari fallback, use a regular Web Worker with `BroadcastChannel` for cross-tab sync.
- **Monorepo tooling:** pnpm workspaces with Vite for builds. TypeScript project references for incremental type checking. Turborepo optional for build caching.
- **MCP transport:** stdio for CLI agents (Claude Code, Cursor). HTTP SSE for web-based agents. Both transports share the same tool handler code.
- **Bundle size:** Core + Vue packages should be < 50KB gzipped. Tree-shaking ensures zero bytes in production builds.
- **Existing dependencies:** `@modelcontextprotocol/sdk` (MCP server), `fastify` (REST API), `zod` (validation). Vue 3 and Pinia are peer dependencies.

---

## Success Metrics

- **M1:** Developer can install VuePoint and create their first annotation in under 2 minutes
- **M2:** AI agent (Claude Code) can read, acknowledge, and resolve an annotation end-to-end via MCP in a single conversation turn
- **M3:** Non-engineer (PM/designer) can annotate a staging build and copy structured output without any terminal usage
- **M4:** Annotation output includes correct SFC file path that maps to actual source file 100% of the time (in dev builds)
- **M5:** Zero production runtime overhead — VuePoint completely tree-shaken from production builds
- **M6:** All 8 MCP tools return correct results when bridge is connected
- **M7:** Webhook delivery succeeds on first attempt > 95% of the time
- **M8:** Multi-tab state stays in sync via SharedWorker with < 100ms latency

---

## Open Questions

1. **SharedWorker vs. simple HTTP server:** Should the bridge be a true SharedWorker (runs in browser, limited to `fetch`-based HTTP from Node), or a lightweight Node.js HTTP server that the browser plugin POSTs to? The SharedWorker approach keeps everything in-browser but complicates the MCP server connection. A Node HTTP server is simpler but requires a separate process.

2. **Annotation persistence:** Currently annotations are ephemeral (lost on page refresh). Should there be optional `localStorage` persistence for single-user scenarios, even though the architecture is designed for real-time agent interaction?

3. **Safari SharedWorker fallback:** Safari 16+ supports SharedWorker but older Safari versions don't. Is Safari support a requirement for JumpCloud's internal staging environments, or is Chrome-only acceptable?

4. **Screenshot capture approach:** `html2canvas` is heavy (~40KB) and has rendering limitations. The Screen Capture API requires user permission per session. Which trade-off is preferred, or should screenshots be deferred entirely to a browser extension approach?

5. **Monorepo tool:** pnpm workspaces alone, or add Turborepo/Nx for build orchestration? For a 5-package monorepo this may be over-engineering.
