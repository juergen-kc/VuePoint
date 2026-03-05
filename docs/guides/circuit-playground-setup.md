# VuePoint + Circuit Playground — Setup Guide

This guide walks you through adding VuePoint to the **circuit-playground** app so your team can annotate UI elements and send structured feedback to AI coding agents (Claude Code, Cursor, etc.).

By the end you'll have:
- The VuePoint annotation toolbar running inside circuit-playground
- The ability to click any element, describe an issue, and copy structured output for AI agents
- (Optional) A live MCP connection so agents can read and resolve annotations in real time

---

## Quick Setup (Automated)

If you prefer an automated setup, run the script from inside your `circuit-playground` directory:

```bash
# Option A: Download and run via gh CLI
gh release download v0.1.0 --repo juergen-kc/VuePoint --pattern 'setup-vuepoint.sh'
chmod +x setup-vuepoint.sh
./setup-vuepoint.sh

# Option B: One-liner via curl
curl -fsSL https://raw.githubusercontent.com/juergen-kc/VuePoint/main/scripts/setup-vuepoint.sh | bash
```

**Prerequisites:** Node >= 18, pnpm >= 10, gh CLI (authenticated), CodeArtifact configured.

The script handles everything: downloading tarballs, installing packages, creating the app shell, and patching Vite config. If you prefer to do it manually, continue with the steps below.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Build VuePoint Tarballs](#2-build-vuepoint-tarballs)
3. [Install into Circuit Playground](#3-install-into-circuit-playground)
4. [Create the App Shell](#4-create-the-app-shell)
5. [Run and Verify](#5-run-and-verify)
6. [Using the Toolbar](#6-using-the-toolbar)
7. [MCP Agent Setup](#7-mcp-agent-setup-optional)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | >= 18 | `node -v` |
| pnpm | >= 10.x | `pnpm -v` |
| Git | any | `git -v` |
| CodeArtifact auth | current session | See below |

### CodeArtifact Authentication

The circuit-playground installs `@jumpcloud/circuit` and `@jumpcloud/icons` from a private CodeArtifact registry. You need an active auth session before running `pnpm install`.

```bash
# Log in to CodeArtifact (ask your team lead for the exact command)
aws codeartifact login --tool npm \
  --repository jumpcloud-node-modules \
  --domain jumpcloud-artifacts \
  --domain-owner 642920845081 \
  --region us-east-2

# Verify it worked
npm config get @jumpcloud:registry
# Should output: https://jumpcloud-artifacts-642920845081.d.codeartifact.us-east-2.amazonaws.com/npm/jumpcloud-node-modules/
```

> **Note:** Auth tokens expire after ~12 hours. If `pnpm install` fails with a 401, re-run the login command.

---

## 2. Build VuePoint Tarballs

VuePoint isn't published to npm yet. Instead, we build portable `.tgz` tarballs that can be installed into any project.

```bash
# 1. Clone the VuePoint repo
git clone https://github.com/juergen-kc/VuePoint.git
cd VuePoint

# 2. Install dependencies and build all packages
pnpm install
pnpm build

# 3. Create tarballs in a known location
mkdir -p tarballs

(cd packages/core && pnpm pack --pack-destination ../../tarballs)
(cd packages/vue && pnpm pack --pack-destination ../../tarballs)
(cd packages/vite-plugin && pnpm pack --pack-destination ../../tarballs)
(cd packages/mcp && pnpm pack --pack-destination ../../tarballs)
```

You should now have 4 files in `tarballs/`:

| File | What it is |
|------|-----------|
| `vuepoint-core-0.1.0.tgz` | Types, CSS selector engine, formatters (no runtime deps) |
| `vuepoint-vue-0.1.0.tgz` | Vue 3 plugin — toolbar UI, annotation store, bridge sync |
| `vite-plugin-vuepoint-0.1.0.tgz` | Auto-injects VuePoint into your app entry (zero config) |
| `vuepoint-mcp-0.1.0.tgz` | MCP server for AI agent integration |

> **Tip:** Copy the `tarballs/` folder to a shared location (Google Drive, S3, Slack) so other team members don't need to clone and build VuePoint themselves.

---

## 3. Install into Circuit Playground

```bash
cd /path/to/circuit-playground

# Copy tarballs into your project (or reference them from wherever you stored them)
mkdir -p tarballs
cp /path/to/VuePoint/tarballs/*.tgz tarballs/
```

### Add VuePoint dependencies

```bash
pnpm add ./tarballs/vuepoint-core-0.1.0.tgz \
         ./tarballs/vuepoint-vue-0.1.0.tgz \
         ./tarballs/vite-plugin-vuepoint-0.1.0.tgz
```

### Handle the `@vuepoint/*` dependency resolution

Since none of the `@vuepoint/*` packages are published to npm, pnpm cannot resolve inter-package dependencies on its own. All three `@vuepoint/*` packages need overrides pointing to the local tarballs. Add this to your `package.json`:

```jsonc
// package.json
{
  // ... your existing config ...
  "pnpm": {
    "overrides": {
      "@vuepoint/core": "file:vuepoint-core-0.1.0.tgz",
      "@vuepoint/bridge": "file:vuepoint-core-0.1.0.tgz",
      "@vuepoint/vue": "file:vuepoint-vue-0.1.0.tgz"
    }
  }
}
```

Then run install again:

```bash
pnpm install
```

---

## 4. Create the App Shell

The circuit-playground is Storybook-only — it doesn't have a `main.ts` entry point that VuePoint's Vite plugin can inject into. We need to create a thin app shell: an `index.html`, `main.ts`, and `App.vue` that render some Circuit components in a normal Vite dev server.

> **Storybook is untouched.** `pnpm storybook` continues to work exactly as before. The app shell adds a separate `pnpm dev` entry point.

### 4a. Create `index.html` (project root)

```html
<!DOCTYPE html>
<html lang="en" data-theme="circuit-light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Circuit Playground</title>
  </head>
  <body class="bg-neutral-base">
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### 4b. Create `src/main.ts`

This mirrors the PrimeVue + Circuit setup from `.storybook/preview.ts`:

```ts
import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import circuitConfig from '@jumpcloud/circuit/primevue'
import { VuePoint } from '@vuepoint/vue'
import App from './App.vue'
import './assets/main.css'

const app = createApp(App)

app.use(PrimeVue, {
  ...circuitConfig,
  theme: 'none',
})
app.use(ToastService)
app.directive('tooltip', Tooltip)
app.use(VuePoint, { enabled: true })

// Provide $testId global property used by Circuit custom components
app.config.globalProperties.$testId = (suffix: string) => suffix

app.mount('#app')
```

> **Note:** The `enabled: true` option ensures VuePoint activates in dev mode. The Vite plugin (`vite-plugin-vuepoint`) is still included for its dev-time features but VuePoint is registered explicitly for reliability.

### 4c. Create `src/App.vue`

A simple layout that showcases some Circuit components for annotation testing:

```vue
<script setup lang="ts">
import TopBar from './components/TopBar.vue'
import ListPageLayout from './components/layout/page-layouts/ListPageLayout.vue'
import Button from 'primevue/button'
</script>

<template>
  <div class="h-screen flex flex-col">
    <TopBar />
    <ListPageLayout>
      <div class="space-y-6">
        <h1 class="text-heading-lg text-content-primary">Circuit Playground</h1>
        <p class="text-body-md text-content-secondary">
          A live preview of Circuit DS components with VuePoint annotations enabled.
        </p>
        <div class="flex gap-3">
          <Button label="Primary" severity="primary" />
          <Button label="Secondary" severity="secondary" />
          <Button label="Danger" severity="danger" />
          <Button label="Outlined" severity="secondary" variant="outlined" />
        </div>
      </div>
    </ListPageLayout>
  </div>
</template>
```

Feel free to import more components — any Circuit or PrimeVue component will work.

### 4d. Update `vite.config.ts`

Add the VuePoint plugin:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import vuePoint from 'vite-plugin-vuepoint';

export default defineConfig({
  plugins: [vue(), tailwindcss(), vuePoint()],
});
```

### 4e. Add a dev script

If `package.json` doesn't already have a `dev` script (or if `dev` is taken by something else):

```jsonc
// package.json
{
  "scripts": {
    "dev": "vite",
    // ... existing scripts
  }
}
```

### 4f. Import the VuePoint CSS

The VuePoint toolbar styles are shipped as a separate CSS file. Import it in your `main.ts`:

```ts
// Add this line after your other imports in src/main.ts
import '@vuepoint/vue/dist/vue.css'
```

---

## 5. Run and Verify

```bash
pnpm dev
```

Open the URL Vite prints (usually `http://localhost:5173`). You should see:

1. Your Circuit components rendering normally
2. A small **"Annotate"** button in the **bottom-right corner** of the page

If you see the button — VuePoint is working. If not, see [Troubleshooting](#8-troubleshooting).

### Quick smoke test

1. Click **"Annotate"** — your cursor changes to a crosshair
2. Hover over an element — it highlights in blue
3. Click the element — a feedback form appears
4. Type "test annotation" and click **"Add Annotation"**
5. A numbered badge (1) appears on the element
6. Click the **clipboard icon** in the toolbar to copy the annotation as structured Markdown

---

## 6. Using the Toolbar

### Annotation Modes

| Mode | How to trigger | Best for |
|------|---------------|----------|
| **Click** | Click any element | Single element issues |
| **Multi-select** | Hold **Shift** and drag | Grouping related elements |
| **Area select** | Hold **Alt/Option** and drag | Layout or spacing issues |
| **Text select** | Select text, then click **"Annotate Selection"** | Typos, copy issues |

### Keyboard Shortcut

**Ctrl+Shift+A** (or **Cmd+Shift+A** on Mac) toggles annotation mode on and off.

### Feedback Form Fields

| Field | Required | Purpose |
|-------|----------|---------|
| **Feedback** | Yes | Describe the issue or suggestion |
| **Expected** | No | What should happen (click "Expected / Actual" to expand) |
| **Actual** | No | What is happening instead |

Press **Cmd+Enter** (or **Ctrl+Enter**) to submit quickly.

### Toolbar Controls

| Control | What it does |
|---------|-------------|
| **Annotate** | Toggle annotation mode |
| **Annotations list** (number badge) | Show/hide the list of all annotations |
| **Copy All** (clipboard icon) | Copy all annotations as structured Markdown |
| **Pause animations** | Freeze CSS animations so you can click moving elements |
| **Dark/Light toggle** | Switch the toolbar theme |
| **Settings** (gear icon) | View webhook delivery log |

### What Gets Copied

When you click "Copy All," each annotation produces output like:

```
## Annotation 1

**Element:** span.p-tag-label "admin"
**Selector:** div[data-testid="users-table"] > tr:nth-child(5) > td:nth-child(3) > span.p-tag > span.p-tag-label
**Component:** <App> → <UserManagement> → <DataTable> → <Tag>
**SFC Path:** src/components/UserManagement.vue
**Route:** /users

**Feedback:** Badge color should be red for revoked users
**Expected:** Red badge for revoked status
**Actual:** Shows green "active" badge
```

Paste this into Claude Code, Cursor, or any AI agent chat — the structured format gives the agent the exact file path, component chain, and CSS selector it needs to locate and fix the code.

### Tips

- **Be specific.** "This button should be disabled when loading" is better than "button is broken."
- **Use Expected/Actual for bugs.** It gives the agent clear before/after context.
- **One issue per annotation.** Multiple annotations are all included in "Copy All."
- **Pause animations first.** Click the pause button before annotating animated elements.
- **Status colors on badges:** Blue = pending, Orange = agent working on it, Green = resolved.

---

## 7. MCP Agent Setup (Optional)

MCP (Model Context Protocol) lets AI agents read and resolve annotations in real time — no copy-paste needed. The agent sees your annotations as soon as you create them, and status updates flow back to your toolbar.

### 7a. Install the MCP server

```bash
# In the circuit-playground (or globally)
pnpm add -D ./tarballs/vuepoint-mcp-0.1.0.tgz
```

### 7b. Enable the API bridge in your app

Update `src/main.ts` to pass MCP/API options:

```ts
// Replace the plain app.mount('#app') with:

// If you're NOT using the vite-plugin (manual setup):
import { VuePoint } from '@vuepoint/vue'

app.use(VuePoint, {
  mcp: { enabled: true, port: 3741 },
  api: { enabled: true, port: 3742 },
})
app.mount('#app')
```

> **If you're using the Vite plugin (recommended):** pass options to the plugin in `vite.config.ts` instead:
> ```ts
> vuePoint({
>   mcp: { enabled: true, port: 3741 },
>   api: { enabled: true, port: 3742 },
> })
> ```

### 7c. Configure Claude Code

Add to your Claude Code MCP settings (`.claude/settings.json` or via the UI):

```json
{
  "mcpServers": {
    "vuepoint": {
      "command": "npx",
      "args": ["vuepoint-mcp"],
      "env": {
        "VUEPOINT_BRIDGE_URL": "http://localhost:3741"
      }
    }
  }
}
```

### 7d. Configure Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "vuepoint": {
      "command": "npx",
      "args": ["vuepoint-mcp"],
      "env": {
        "VUEPOINT_BRIDGE_URL": "http://localhost:3741"
      }
    }
  }
}
```

### 7e. Test the connection

1. Start the playground: `pnpm dev`
2. Open the page in your browser and create an annotation
3. In Claude Code, ask: *"Check for VuePoint annotations"*
4. The agent should call `vuepoint_get_annotations` and see your annotation

### Available MCP Tools

| Tool | What it does |
|------|-------------|
| `vuepoint_get_annotations` | List all annotations (optionally filter by status) |
| `vuepoint_get_annotation` | Get a single annotation by ID |
| `vuepoint_acknowledge` | Mark as "working on it" (badge turns orange) |
| `vuepoint_resolve` | Mark as fixed with a summary (badge turns green) |
| `vuepoint_dismiss` | Mark as "won't fix" with a reason |
| `vuepoint_ask` | Send a clarifying question back to the annotator |
| `vuepoint_get_component_info` | Inspect a component by CSS selector or name |
| `vuepoint_get_app_context` | Get current route, page component, active stores |

### Agent Workflow

```
1. Agent calls vuepoint_get_annotations({ status: 'pending' })
2. For each annotation:
   a. Agent calls vuepoint_acknowledge({ id })       → badge turns orange
   b. Agent reads sfcPath + selector to find the code
   c. Agent fixes the issue
   d. Agent calls vuepoint_resolve({ id, summary })  → badge turns green
```

If the agent needs clarification:
```
3. Agent calls vuepoint_ask({ id, question: '...' })
4. You see the question in the toolbar and reply
5. Agent reads the reply and continues
```

---

## 8. Troubleshooting

### Toolbar doesn't appear

**Most common cause:** The VuePoint CSS isn't loaded. Make sure you have this import in `src/main.ts`:

```ts
import '@vuepoint/vue/dist/vue.css'
```

**Other causes:**
- The Vite plugin didn't detect `createApp()` — check the terminal for `[vite-plugin-vuepoint] Injected VuePoint into main.ts`. If missing, verify your `main.ts` uses the pattern `const app = createApp(App)` followed by `app.mount(...)`.
- You're in production mode — VuePoint auto-disables when `NODE_ENV === 'production'`.

### `pnpm install` fails with 401 Unauthorized

Your CodeArtifact session expired. Re-run the `aws codeartifact login` command from [Prerequisites](#1-prerequisites).

### `pnpm install` fails with "Cannot resolve @vuepoint/bridge"

You need the `pnpm.overrides` in your `package.json`. See [Step 3](#3-install-into-circuit-playground).

### Port 5173 is already in use

Vite automatically picks the next available port (5174, 5175, etc.). Check the terminal output for the actual URL.

### Duplicate Vue instance warnings

If you see `[Vue warn]: App already provides property...` or components don't render correctly, add `resolve.dedupe` to your `vite.config.ts`:

```ts
export default defineConfig({
  // ... plugins ...
  resolve: {
    dedupe: ['vue'],
  },
})
```

### Annotation marker appears on the wrong element

If two elements have the same tag/classes (e.g., multiple "admin" badges in a table), VuePoint generates a CSS selector using `nth-child` to disambiguate. If you still see incorrect placement, try annotating a more specific child element instead.

### MCP server can't connect

- Make sure the playground is running (`pnpm dev`)
- Make sure you enabled `mcp: { enabled: true, port: 3741 }` in the plugin options
- Check that port 3741 isn't blocked by a firewall
- In Claude Code, check the MCP server logs for connection errors

### Storybook still works?

Yes. The app shell (`index.html` + `src/main.ts`) is only used by `pnpm dev` (Vite). Storybook has its own entry point (`.storybook/preview.ts`) and continues to work with `pnpm storybook`.

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start the app with VuePoint toolbar |
| `pnpm storybook` | Start Storybook (unchanged) |
| **Ctrl+Shift+A** | Toggle annotation mode |
| Click element | Capture element for annotation |
| **Shift+Drag** | Multi-select elements |
| **Alt+Drag** | Area selection |
| Clipboard icon | Copy all annotations as Markdown |

---

*Questions? Reach out to Juergen or check the [VuePoint docs](https://github.com/juergen-kc/VuePoint).*
