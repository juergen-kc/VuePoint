# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VuePoint is a monorepo Vue 3 annotation tool that lets teams annotate live UIs and send structured feedback to AI coding agents. Built with pnpm workspaces.

## Commands

### Development
- `pnpm dev` — Run playground app (Vue + PrimeVue demo)
- `pnpm dev:dashboard` — Run annotation dashboard (port 3743)

### Build & Check
- `pnpm build` — Build all packages
- `pnpm typecheck` — Run `tsc --noEmit`
- `pnpm lint` — ESLint across packages and playground

### Testing
- `pnpm test` — Run all tests (Vitest)
- `pnpm vitest run packages/core/src/selector.test.ts` — Run a single test file
- `pnpm vitest -t "test name"` — Run tests matching a name pattern

Test files use `*.test.ts` or `*.spec.ts` convention. DOM tests use `happy-dom` environment.

## Architecture

### Package Dependency Graph
```
@vuepoint/core (types, selectors, formatters — no deps)
  ↑
@vuepoint/bridge (SharedWorker multi-tab sync — depends on core)
  ↑
@vuepoint/vue (Vue 3 plugin, composables, toolbar UI — depends on core + bridge)
  ↑
@vuepoint/vite-plugin (zero-config Vite integration — depends on vue)

@vuepoint/api (Fastify REST API + WebSocket server — depends on core)
  ↑
@vuepoint/mcp (MCP server over stdio, calls API via HTTP — depends on core)

@vuepoint/extension (Chrome extension — standalone)
@vuepoint/dashboard (annotation monitoring UI — standalone Vue app)
@vuepoint/nuxt (Nuxt 3 module wrapper — depends on vue)
```

### Data Flow
```
Browser Tab (Vue plugin) → SharedWorker (canonical state) → API server (:3741/:3742)
                                                              ↑
                                                         MCP server (stdio) ← Claude/Cursor
```

1. User creates annotation in browser → `useAnnotationsStore.create()`
2. Bridge client syncs to SharedWorker (postMessage) → SharedWorker syncs to API (fetch)
3. Agent reads via MCP tools → MCP server fetches from API via HTTP bridge
4. Agent resolves/asks → API pushes back through WebSocket → SharedWorker broadcasts to tabs

### Key Source Files
| File | Purpose |
|------|---------|
| `packages/core/src/types.ts` | Central type definitions (Annotation, VuePointOptions) |
| `packages/core/src/selector.ts` | CSS selector generation from DOM elements |
| `packages/vue/src/plugin.ts` | Vue plugin entry — mounts toolbar, sets up bridge sync |
| `packages/vue/src/composables/useAnnotations.ts` | Reactive annotation store (NOT Pinia) |
| `packages/bridge/src/client.ts` | Browser-side SharedWorker connection |
| `packages/bridge/src/worker.ts` | SharedWorker — canonical state, multi-tab coordination |
| `packages/api/src/api.ts` | Fastify REST API + HTTP bridge + WebSocket |
| `packages/mcp/src/server.ts` | MCP server with 8 tools, talks to API via fetch |
| `packages/vite-plugin/src/index.ts` | Auto-injects VuePoint into app entry file during dev |

### Key Patterns
- **Annotation store is NOT Pinia** — intentionally isolated from host app via Vue `provide/inject`
- **Monkey-patching** in `plugin.ts` — store methods are wrapped to sync changes through bridge
- **SharedWorker as canonical state** — browser tabs are clients, API is persistence layer
- **Separate Vue app for toolbar** — mounted to `#__vuepoint-root` to avoid polluting host component tree
- **Production guard** — plugin auto-disables when `NODE_ENV !== 'development'`
- **PrimeVue filtering** — component chain extraction filters out PrimeVue internals by default

## VuePoint MCP Agent Workflow

When VuePoint MCP is connected, you have access to:

- `vuepoint_get_annotations` — see what UI issues the team has flagged
- `vuepoint_acknowledge` — let the annotator know you're working on it
- `vuepoint_resolve` — mark fixed, include a summary of what changed
- `vuepoint_dismiss` — mark as won't fix, with a reason
- `vuepoint_ask` — send a clarifying question back to the annotator
- `vuepoint_get_component_info` — inspect a component by selector or name
- `vuepoint_get_app_context` — get current route, page component, active stores

### Agent Workflow
1. Call `vuepoint_get_annotations()` to see pending items
2. For each annotation, `vuepoint_acknowledge({ id })` to signal you're on it
3. Use the `selector`, `componentChain`, and `sfcPath` to find the exact code:
   - `selector` → grep/find in templates
   - `sfcPath` → open the exact `.vue` file
   - `componentChain` → understand the component hierarchy
4. Fix the issue
5. Call `vuepoint_resolve({ id, summary: "what you changed" })`

### Annotation Output Format
```
Selector:   .user-management-view .toolbar > .p-button:nth-child(2)
Component:  <App> → <UserManagementView> → <UserToolbar> → <PButton>
SFC Path:   src/views/users/UserManagementView.vue
Feedback:   Button stays active during loading state
Expected:   Button disabled + spinner while usersStore.loading === true
Actual:     Triggers duplicate API calls
```

### Tips
- The `componentChain` is ordered from app root to most specific component
- `sfcPath` is relative to the project root — use it directly with file tools
- PrimeVue internals are filtered out — you'll only see your own components
- If the annotation includes `piniaStores`, check those stores for relevant state

## Tech Stack
- **Runtime**: Node >=18, Vue 3.5+, TypeScript 5.7 (strict)
- **Build**: Vite 6, `vite-plugin-dts` for type declarations
- **Test**: Vitest 4 with happy-dom
- **Lint**: ESLint 10 flat config (typescript-eslint + eslint-plugin-vue)
- **Package manager**: pnpm 10.30+ with workspaces
- **API**: Fastify 5 with WebSocket support
- **MCP**: @modelcontextprotocol/sdk 1.12
