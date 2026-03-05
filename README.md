# VuePoint

Visual annotation tool for Vue 3 — point at any UI element in your live app and generate structured feedback that AI coding agents (Claude Code, Cursor) can act on directly.

---

## For Designers & Product Managers

You don't need to understand the code. Here's how to use VuePoint once a developer has added it to your staging environment:

1. **Look for the VuePoint button** in the bottom-right corner of the page — it looks like a small pencil icon.

2. **Click "Annotate"** (or press `Ctrl+Shift+A` / `Cmd+Shift+A` on Mac).

3. **Click on any element** you want to give feedback on. The cursor will change to a crosshair.

4. **Type your feedback** in the box that appears. Be specific:
   - ✅ "The 'Add User' button should be greyed out while the page is loading"
   - ✅ "This dropdown closes when I click inside it — it should stay open"
   - ❌ "Fix the button" ← too vague for an AI agent

5. **Click "Add Annotation"** (or press `Cmd+Enter`).

6. **Repeat** for any other issues you've spotted.

7. **Click the copy icon** (clipboard) to copy all your annotations as structured text.

8. **Paste into Claude Code or Cursor** — the AI agent will see exactly which component and file to look at, no back-and-forth needed.

---

## For Developers

### Install

VuePoint is distributed as tarballs (not yet on npm). For **circuit-playground** users, run the automated setup script:

```bash
# From inside your circuit-playground directory:
curl -fsSL https://raw.githubusercontent.com/juergen-kc/VuePoint/main/scripts/setup-vuepoint.sh | bash
```

See the [Circuit Playground Setup Guide](docs/guides/circuit-playground-setup.md) for manual installation steps or for installing into other projects using the tarball files.

### Register the plugin

```ts
// main.ts
import { createApp } from 'vue'
import { VuePoint } from '@vuepoint/vue'
import App from './App.vue'

const app = createApp(App)

// enabled: true ensures VuePoint activates in dev mode
app.use(VuePoint, { enabled: true })

app.mount('#app')
```

### With all options

```ts
app.use(VuePoint, {
  // Only run on staging (auto-disabled in prod by default)
  enabled: import.meta.env.VITE_STAGING === 'true',

  // Pinia integration — surfaces which stores a component uses
  pinia: {
    enabled: true,
    instance: pinia, // the instance returned by createPinia()
  },

  // MCP server for Claude Code / Cursor (runs alongside your dev server)
  mcp: {
    enabled: true,
    port: 3742,
  },

  // REST API + webhooks
  api: {
    enabled: true,
    port: 3742,
  },

  // Push annotation events to Slack, Linear, etc.
  webhooks: [
    {
      url: 'https://hooks.slack.com/your-webhook-url',
      events: ['annotation.created'],
    },
  ],
})
```

### Connect Claude Code to VuePoint MCP

Add to your `.claude/mcp.json` (or equivalent Cursor config):

```json
{
  "mcpServers": {
    "vuepoint": {
      "command": "node",
      "args": ["node_modules/@vuepoint/mcp/dist/server.js"],
      "env": {
        "VUEPOINT_BRIDGE_URL": "http://localhost:3742"
      }
    }
  }
}
```

---

## How it works (technical summary)

When you click an element, VuePoint:

1. Generates a unique CSS selector path (`.user-management-view > .toolbar > .p-button:nth-child(2)`)
2. Walks `element.__vueParentComponent` up the Vue 3 instance tree to get real component names
3. Extracts the SFC file path from `component.type.__file` (set by Vite in dev builds)
4. Filters out PrimeVue internals (configurable) so you see your components, not library ones
5. Formats everything as structured Markdown for paste into any AI agent

The MCP server exposes the annotation state to agents directly, so they can fetch, acknowledge, and resolve annotations without copy-paste.

---

## Requirements

- Vue 3.4+
- Vite (for `__file` SFC path resolution — works with webpack too but paths may differ)
- Node.js 20+ (for MCP server and API)
- Dev build only (`__vueParentComponent` is stripped in production)
