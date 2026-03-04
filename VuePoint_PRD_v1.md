# VuePoint
## Visual Annotation & AI Agent Feedback Tool for Vue 3
### Product Requirements Document — v1.0

---

| Field | Value |
|---|---|
| **Author** | Juergen Klaassen |
| **Status** | Decisions Resolved — Ready for Implementation |
| **Created** | March 2026 |
| **Repo target** | github.com/jumpcloud-internal/vuepoint (private) |
| **Distribution** | JumpCloud internal only — not published to public npm |
| **License** | Internal / proprietary |
| **Inspired by** | agentation.dev (PolyForm Shield — original code NOT reused) |

---

## 1. Overview & Problem Statement

Agentation is a breakthrough developer tool that adds a visual annotation toolbar to live React apps, letting engineers point at UI elements and generate structured, greppable feedback for AI coding agents like Claude Code and Cursor. Instead of describing "the blue button on the left," developers hand an agent a precise CSS selector and component hierarchy, cutting feedback loops from minutes to seconds.

**VuePoint** is the Vue 3-native equivalent — built from scratch, with three key goals beyond Agentation:

- Full Vue 3 component hierarchy resolution (via `__vueParentComponent`), including SFC file paths
- Zero-friction install targeting non-engineering stakeholders — designers and PMs, not just developers
- First-class integration surface: REST API, MCP server, and webhooks for any agent toolchain

VuePoint is purpose-built for teams using Vue 3 — including PrimeVue-based design systems like JumpCloud's Circuit Playground.

---

## 2. Goals & Non-Goals

### Goals

- **G1** — Vue 3 component resolution: Surface real component names and SFC file paths when annotating elements
- **G2** — Non-engineer friendly: One-line install, zero configuration required to get started
- **G3** — Feature parity with Agentation v2.0: All annotation, output, and MCP capabilities matched
- **G4** — Beyond parity: Vue-specific enhancements including Pinia store context, SFC file links, and PrimeVue-aware filtering
- **G5** — Universal agent compatibility: Works with Claude Code, Cursor, Windsurf, GitHub Copilot, and any MCP-capable client
- **G6** — Integration-first: REST API, MCP server, and webhooks supported out of the box
- **G7** — Production safe: Automatically disabled in production builds, zero runtime overhead

### Non-Goals

- Not a code generator — VuePoint provides context to agents; it does not generate code itself
- Not React-compatible — this is intentionally Vue 3 only
- Not a visual design tool — no Figma-like canvas or UI generation
- Not a full error tracking or observability platform

---

## 3. Target Users & Use Cases

| User | Primary Use Case | Key Needs |
|---|---|---|
| Product Manager | Annotate live staging builds to give AI agents precise UI feedback without writing code | Zero config, copy-paste output, works in browser |
| UX Designer | Mark up UI prototypes and send structured feedback directly to Cursor or Claude Code | Non-technical, intuitive toolbar, screenshot-free |
| Frontend Developer | Iterate on Vue components with AI agents using exact selector + component path context | SFC file paths, Pinia context, Composition API aware |
| QA / Tester | File precise visual bug reports that agents can act on without back-and-forth | Multi-select, area annotation, text selection |
| Engineering Manager | Deploy VuePoint to staging environments team-wide via plugin | Env-gated, team dashboard (roadmap), webhook alerts |

---

## 4. Feature Specification

### 4.1 Parity Matrix vs. Agentation

| Feature | Agentation | VuePoint | Notes |
|---|---|---|---|
| Click to annotate | ✅ | ✅ | Pure DOM — direct port |
| Text selection annotation | ✅ | ✅ | Direct port |
| Multi-select (drag) | ✅ | ✅ | Direct port |
| Area selection | ✅ | ✅ | Direct port |
| Animation pause | ✅ | ✅ | Direct port |
| CSS selector output | ✅ | ✅ | Direct port |
| React fiber tree walk | ✅ | n/a | React only |
| **Vue component hierarchy** | n/a | ✅ Vue+ | `__vueParentComponent` walk |
| **SFC file path in output** | n/a | ✅ Vue+ | `__file` → src path |
| **PrimeVue / lib filtering** | n/a | ✅ Vue+ | Configurable filter list |
| **Pinia store context** | n/a | ✅ Vue+ | Which stores component reads |
| Markdown output (copy) | ✅ | ✅ | Direct port |
| Dark/light mode | ✅ | ✅ | Direct port |
| Zero dependencies | ✅ | ✅ | Vue plugin only |
| MCP server | ✅ v2.0 | ✅ | Full port + Vue enhancements |
| **REST API** | ❌ | ✅ Vue+ | New: HTTP annotation endpoints |
| **Webhooks** | ❌ | ✅ Vue+ | New: push annotations to URLs |
| **Nuxt 3 support** | ❌ | ✅ Vue+ | Route + page component context |
| Auto-disable in prod | ✅ | ✅ | NODE_ENV guard |
| One-line install | ✅ (React) | ✅ | `app.use(VuePoint)` |
| Claude Code skill (npx) | ✅ | ✅ | Port agentation skill pattern |
| **Screenshot capture** | ❌ | ✅ Vue+ | Phase 2 — html2canvas |

### 4.2 Core Annotation Engine

#### Click Annotation

When a user activates the toolbar and clicks an element, VuePoint captures:

- CSS selector (unique path from root)
- Element bounding rect and position
- Text content / aria-label / placeholder
- Vue 3 component hierarchy (walked from `__vueParentComponent` up to app root)
- SFC file path extracted from `component.type.__file`
- Relevant Pinia store IDs if component accesses any (opt-in)

#### Component Hierarchy Resolution — Core Algorithm

This is VuePoint's key differentiator. The walk function:

```ts
// useVueInspector.ts
function getVueHierarchy(el: Element): VueComponentInfo[] {
  const chain: VueComponentInfo[] = []
  let instance = (el as any).__vueParentComponent

  while (instance) {
    const type = instance.type
    const name = type.__name          // <script setup> inferred name
               || type.name           // defineComponent({ name })
               || type.__file         // SFC filename fallback
                    ?.split('/')
                    .pop()
                    ?.replace('.vue', '')

    if (name && !isVueBuiltin(name) && !isFilteredLib(name)) {
      chain.push({
        name,
        file: type.__file,
        props: instance.props,
      })
    }
    instance = instance.parent
  }
  return chain.reverse()  // App → Page → ... → Target
}
```

#### Structured Output Format

```markdown
## VuePoint Annotation

**Element:** button.p-button.p-button-primary
**Selector:** `.user-management-view .toolbar > .p-button:nth-child(2)`
**Component:** `<UserManagementView> → <UserToolbar> → <PButton>`
**SFC Path:** `src/views/users/UserManagementView.vue`
**Pinia Stores:** useUsersStore, useAuthStore

**Feedback:** The 'Add User' button does not respond when the users
store is in loading state — spinner should disable this button.

**Expected:** Button disabled + spinner visible while usersStore.loading === true
**Actual:** Button remains active and triggers duplicate API calls
```

### 4.3 Toolbar UX

- Collapsed by default — single icon FAB, expands on click. Never obstructs content.
- Keyboard shortcut to toggle (configurable, default: `Cmd/Ctrl+Shift+A`)
- Annotation mode indicated by cursor change and subtle overlay highlight on hover
- Annotation markers are numbered badges placed at the annotated element
- Annotation list panel shows all current annotations with edit/delete
- Expected / Actual optional fields in the feedback form
- Agent question display — when MCP agent calls `vuepoint_ask`, question surfaces in toolbar
- "Copy All" generates the full markdown block for paste into any agent
- "Send to MCP" button pushes annotations directly to connected agent
- Delivery log for webhook status (settings panel)
- Dark/light mode toggle

### 4.4 Installation & Configuration

#### Zero-Config Install

```bash
# Via internal git
npm install git+https://github.com/jumpcloud-internal/vuepoint.git -D

# Or via internal registry
npm install @jumpcloud/vuepoint -D
```

```ts
// main.ts — two lines, done
import { VuePoint } from '@jumpcloud/vuepoint'
app.use(VuePoint)
```

#### Full Configuration (all optional)

```ts
app.use(VuePoint, {
  // Master switch — auto-disabled in production by default
  enabled: process.env.NODE_ENV !== 'production',

  // Component filtering — skip internals from UI libraries
  // false = no filtering | string[] = replace default list
  filterComponents: ['PButton', 'PDialog', ...primevueBuiltins],

  // Keyboard shortcut
  shortcut: 'ctrl+shift+a',

  // Pinia integration (opt-in)
  pinia: {
    enabled: true,
    instance: pinia,
  },

  // MCP server
  mcp: {
    enabled: true,
    port: 3741,
    authToken: process.env.VUEPOINT_TOKEN,
  },

  // REST API
  api: {
    enabled: true,
    port: 3742,
    authToken: process.env.VUEPOINT_TOKEN,
    cors: ['https://staging.jumpcloud.com'],
  },

  // Webhooks
  webhooks: [
    {
      url: 'https://hooks.slack.com/your-webhook',
      secret: process.env.WEBHOOK_SECRET,
      events: ['annotation.created'],
    },
  ],

  appMeta: {
    name: 'JumpCloud Admin',
    version: '3.2.1',
  },
})
```

#### Nuxt 3 Module

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@jumpcloud/nuxt-vuepoint'],
  vuepoint: { enabled: !process.env.NUXT_PUBLIC_PROD },
})
```

---

## 5. MCP Server Specification

VuePoint ships a built-in MCP server enabling any MCP-capable agent to read, acknowledge, and resolve annotations in real time.

### 5.1 Transport & Configuration

- Default port: 3741 (configurable)
- Transport: stdio (Claude Code / Cursor) or HTTP SSE (web-based agents)
- Auth: optional bearer token
- Launch: `npx vuepoint mcp` or auto-started by plugin config

### 5.2 MCP Tools

| Tool | Description | Returns |
|---|---|---|
| `vuepoint_get_annotations` | Fetch all pending annotations | Array with selector, component chain, SFC path, feedback |
| `vuepoint_get_annotation` | Get single annotation by ID | Full annotation object |
| `vuepoint_acknowledge` | Mark as in-progress — updates toolbar badge | Updated annotation |
| `vuepoint_resolve` | Mark as resolved with optional summary | Annotation removed from pending; webhook fired |
| `vuepoint_dismiss` | Dismiss with reason | Annotation archived |
| `vuepoint_ask` | Send clarifying question — appears in toolbar | User response when answered |
| `vuepoint_get_component_info` | Query component by selector or name | Props schema, SFC path, Pinia stores |
| `vuepoint_get_app_context` | Get current route, page component, active stores | Route, page component, store IDs |

### 5.3 Claude Code Config

```json
// .claude/mcp.json
{
  "mcpServers": {
    "vuepoint": {
      "command": "node",
      "args": ["node_modules/@jumpcloud/vuepoint/packages/mcp/dist/server.js"],
      "env": {
        "VUEPOINT_BRIDGE_URL": "http://localhost:3741"
      }
    }
  }
}
```

### 5.4 Agent Workflow Example

```
> What's pending in VuePoint?

Tool: vuepoint_get_annotations()
→ 3 annotations pending
  [1] 'Add User button stays active during loading'
      Selector: .toolbar > .p-button:nth-child(2)
      Component: UserManagementView → UserToolbar → PButton
      File: src/views/users/UserManagementView.vue

> Fix annotation 1

Tool: vuepoint_acknowledge({ id: 1 })
// Agent greps for UserToolbar.vue, finds the component,
// reads the Pinia store binding, adds :disabled='usersStore.loading'
Tool: vuepoint_resolve({ id: 1, summary: 'Added :disabled binding to PButton' })
```

---

## 6. REST API Specification

### 6.1 Base URL & Auth

- Default: `http://localhost:3742/api/v1`
- Auth: `Authorization: Bearer <token>` (optional, configured in plugin)
- CORS: configurable allowed origins

### 6.2 Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/annotations` | List annotations (`?status=pending\|resolved\|all`) |
| `GET` | `/annotations/:id` | Get single annotation |
| `POST` | `/annotations` | Create annotation programmatically |
| `PATCH` | `/annotations/:id` | Update status / add notes |
| `DELETE` | `/annotations/:id` | Hard delete |
| `GET` | `/annotations/export` | Export as Markdown, JSON, or CSV |
| `GET` | `/component` | Query by `?selector=.foo` or `?name=UserCard` |
| `GET` | `/context` | Current route, page component, active stores |
| `POST` | `/context` | Browser plugin syncs context here |
| `GET` | `/health` | Health check |
| `POST` | `/webhooks/test` | Trigger test delivery |
| `GET` | `/webhooks` | List configured webhooks |

---

## 7. Webhooks Specification

### 7.1 Events

| Event | Trigger |
|---|---|
| `annotation.created` | New annotation added |
| `annotation.updated` | Feedback or notes edited |
| `annotation.acknowledged` | Agent acknowledged via MCP |
| `annotation.resolved` | Agent marked as fixed |
| `annotation.dismissed` | Dismissed with reason |
| `annotation.batch_copied` | User copied all as Markdown |
| `session.started` | Toolbar activated |
| `session.ended` | Annotations cleared / session reset |

### 7.2 Payload Schema

```json
{
  "event": "annotation.created",
  "timestamp": "2026-03-04T14:23:00Z",
  "annotation": {
    "id": "ann_01HX...",
    "selector": ".user-management-view .toolbar > button",
    "componentChain": ["App", "UserManagementView", "UserToolbar", "PButton"],
    "sfcPath": "src/views/users/UserManagementView.vue",
    "piniaStores": ["useUsersStore"],
    "feedback": "Button stays active during loading state",
    "expected": "Button should be disabled with spinner",
    "actual": "Triggers duplicate API calls",
    "route": "/users",
    "status": "pending"
  },
  "meta": {
    "appName": "JumpCloud Admin",
    "appVersion": "3.2.1",
    "sessionId": "ann_lp3k9z4f2"
  }
}
```

### 7.3 Security

- HMAC-SHA256 signed — signature in `X-VuePoint-Signature-256` header
- Retry: 3 attempts with exponential backoff (1s → 5s → 30s)
- Delivery log viewable in toolbar settings panel

---

## 8. Technical Architecture

### 8.1 Monorepo Structure

```
vuepoint/
├── packages/
│   ├── core/                  # Framework-agnostic — types, selector, output formatter
│   │   └── src/
│   │       ├── types.ts
│   │       ├── selector.ts
│   │       ├── output.ts
│   │       └── primevue-filter.ts
│   ├── vue/                   # Vue 3 plugin (primary package)
│   │   └── src/
│   │       ├── plugin.ts
│   │       ├── components/
│   │       │   ├── VuePointToolbar.vue
│   │       │   ├── AnnotationMarker.vue
│   │       │   └── AnnotationPanel.vue
│   │       └── composables/
│   │           ├── useVueInspector.ts   ← the core __vueParentComponent walker
│   │           └── useAnnotations.ts
│   ├── bridge/                # SharedWorker — browser ↔ Node state sync  ← NOT YET BUILT
│   │   └── src/
│   │       └── worker.ts
│   ├── nuxt/                  # Nuxt 3 module wrapper
│   ├── mcp/                   # MCP server (stdio + HTTP SSE)
│   │   └── src/server.ts
│   └── api/                   # REST API + webhook engine (Fastify)
│       └── src/api.ts
├── playground/                # Dev test app (Vue 3 + PrimeVue)
├── docs/                      # Documentation site (VitePress)
├── CLAUDE.md                  # Claude Code skill file
└── README.md
```

### 8.2 Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Component resolution | `__vueParentComponent` walk | Available in Vue 3 dev builds; same approach as Vue DevTools |
| Plugin architecture | `app.use()` + isolated app instance | Toolbar is its own Vue app — never appears in host component tree |
| Server transport | MCP over stdio + HTTP SSE | stdio for Claude Code/Cursor; HTTP for web agents and REST clients |
| Browser ↔ Node bridge | SharedWorker + local HTTP | SharedWorker holds annotation state; Node process handles outbound webhooks |
| Build output | ESM + CJS dual build via Vite | Maximum bundler compatibility |
| Prod guard | `NODE_ENV` check + Vite define | Zero overhead in prod; tree-shaken entirely |
| TypeScript | Full strict TS throughout | Required for developer adoption and DX |
| Pinia integration | Optional peer dep, explicit opt-in | Avoid forcing Pinia on non-Pinia apps |
| License | Internal / proprietary | JumpCloud-internal tool; sidesteps PolyForm Shield conflict cleanly |

### 8.3 The Browser ↔ Node Bridge (Critical Missing Piece)

The SharedWorker is the nervous system of VuePoint — without it the MCP server and REST API have no live connection to what's happening in the browser.

Architecture:
```
Browser (Vue plugin)
  └─ SharedWorker (bridge/src/worker.ts)
        ├─ Receives annotation events from VuePointToolbar
        ├─ Exposes WebSocket server on ws://localhost:3741/ws
        └─ HTTP endpoints on http://localhost:3741/api/...
              ├─ MCP server reads/writes via HTTP
              └─ REST API server reads/writes via HTTP
```

The SharedWorker approach means multiple browser tabs all share the same annotation state and all feed the same MCP/API surface.

---

## 9. Implementation Roadmap

### Phase 1 — Core (MVP) · ~10 hours ✅ ~70% done

- [x] `useVueInspector.ts` — `__vueParentComponent` walker + component name/file resolution
- [x] CSS selector generation
- [x] `VuePointToolbar.vue` — activate, click, annotate, copy output
- [x] Markdown output formatter with Vue-specific fields
- [x] Vue plugin wrapper with env guard
- [ ] Expected / Actual fields in feedback UI
- [ ] Dark/light mode toggle
- [ ] Playground app (Vue 3 + PrimeVue)

### Phase 2 — Enhanced Annotation · ~8 hours ❌ Not started

- [ ] Multi-select and area selection
- [ ] Text selection annotation
- [ ] Animation pause
- [ ] Annotation list panel improvements (edit inline, reorder)
- [ ] Expected / Actual fields in feedback form
- [ ] Agent question display in toolbar (`vuepoint_ask` response surface)
- [ ] Pinia store context — per-component store resolution (not just all stores)
- [ ] Screenshot capture per annotation (html2canvas or Screen Capture API)
- [ ] Dark/light mode toggle

### Phase 3 — Integration Surface · ~12 hours ⚠️ ~60% done

- [x] MCP server — all 8 tools defined and wired (code exists)
- [x] REST API — full CRUD, export, webhook engine with HMAC + retry (code exists)
- [ ] **SharedWorker bridge** — browser ↔ Node state sync (critical gap)
- [ ] Context sync — browser plugin POSTs route/component to `/api/v1/context`
- [ ] `vuepoint_get_component_info` — needs browser bridge to resolve live DOM queries
- [ ] Webhook delivery log UI in toolbar settings

### Phase 4 — Ecosystem · ~10 hours ❌ Not started

- [ ] Nuxt 3 module (`@jumpcloud/nuxt-vuepoint`)
- [ ] Internal documentation site (VitePress)
- [ ] Non-technical install guide targeting PMs and designers
- [ ] Internal GitHub repo setup with CI (typecheck, test, lint)
- [ ] Onboarding guide and walkthrough video

### Phase 5 — Roadmap (Post-Launch)

- [ ] Browser extension (no-install-required for staging links)
- [ ] Slack webhook template (annotation → Slack message with screenshot)
- [ ] Linear / Jira webhook templates
- [ ] Team annotation dashboard (shared live session via WebSocket)
- [ ] `vite-plugin-vuepoint` (zero-config Vite plugin)

---

## 10. Design Decisions Log

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Product name | **VuePoint** | Clear, memorable, Vue-native |
| 2 | Distribution | **JumpCloud internal only** | Purpose-built for Circuit Playground stack |
| 3 | MCP + API hosting | **Both: SharedWorker + Node.js** | SharedWorker for browser state; Node for outbound webhooks/REST |
| 4 | Vue 2 support | **Not needed** | JumpCloud is Vue 3 only; Vue 2 EOL Jan 2024 |
| 5 | Pinia integration | **Explicit opt-in** | Not all Vue 3 apps use Pinia; keeps bundle lean |
| 6 | Screenshot capture | **Phase 2 scope** | html2canvas or Screen Capture API; useful for async review |
| 7 | PrimeVue filtering | **Configurable with smart defaults** | Ship PrimeVue preset; user can extend/replace/disable |

---

## 11. Scaffold Implementation Status

The initial scaffold at `github.com/jumpcloud-internal/vuepoint` covers:

| File | Description | Status |
|---|---|---|
| `packages/core/src/types.ts` | All shared TypeScript types | ✅ Complete |
| `packages/core/src/selector.ts` | CSS selector generation | ✅ Complete |
| `packages/core/src/output.ts` | Markdown formatter | ✅ Complete |
| `packages/core/src/primevue-filter.ts` | PrimeVue component filter list | ✅ Complete |
| `packages/vue/src/composables/useVueInspector.ts` | `__vueParentComponent` walker | ✅ Complete |
| `packages/vue/src/composables/useAnnotations.ts` | Annotation state store | ✅ Complete |
| `packages/vue/src/plugin.ts` | Vue plugin entry | ✅ Complete |
| `packages/vue/src/components/VuePointToolbar.vue` | Main toolbar overlay | ✅ Core done, Phase 2 features missing |
| `packages/vue/src/components/AnnotationMarker.vue` | Numbered element badges | ✅ Complete |
| `packages/vue/src/components/AnnotationPanel.vue` | Annotation list panel | ✅ Complete |
| `packages/mcp/src/server.ts` | MCP server (8 tools) | ✅ Code complete — needs bridge |
| `packages/api/src/api.ts` | REST API + webhooks | ✅ Code complete — needs bridge |
| `packages/bridge/src/worker.ts` | SharedWorker bridge | ❌ **Not built — start here** |
| `packages/nuxt/` | Nuxt 3 module | ❌ Phase 4 |
| `playground/` | Test app | ❌ Phase 1 remainder |
| `CLAUDE.md` | Claude Code skill | ✅ Complete |
| `README.md` | Install guide | ✅ Complete |

**Recommended next task for Claude Code:** Build `packages/bridge/src/worker.ts` — the SharedWorker that holds annotation state and proxies it to the MCP and REST API servers over local HTTP/WebSocket.
