# Getting Started

VuePoint adds a visual annotation toolbar to your Vue 3 application. Engineers, designers, and PMs can click on UI elements to generate structured, machine-readable feedback that AI coding agents can act on directly.

## Installation

```bash
# Using pnpm (recommended)
pnpm add @vuepoint/vue

# Using npm
npm install @vuepoint/vue

# Using yarn
yarn add @vuepoint/vue
```

## Basic Setup

Register the plugin in your Vue app entry file:

```ts
// main.ts
import { createApp } from 'vue'
import { VuePoint } from '@vuepoint/vue'
import '@vuepoint/vue/dist/vue.css'
import App from './App.vue'

const app = createApp(App)
app.use(VuePoint, { enabled: true })
app.mount('#app')
```

That's it. VuePoint is now active in development mode. Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> to toggle the toolbar.

## How It Works

1. **Activate** — Click the floating action button or press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd>
2. **Annotate** — Click any element in your app. VuePoint captures:
   - A unique CSS selector
   - The full Vue component chain (e.g., `<App> → <UserList> → <UserCard>`)
   - The SFC file path (e.g., `src/components/UserCard.vue`)
   - Pinia store references (optional)
   - Current route context
3. **Describe** — Add feedback text, plus optional "Expected" and "Actual" fields
4. **Export** — Click "Copy All" to get structured Markdown output, ready to paste into any AI agent chat

### Example Output

```
## Annotation 1

**Element:** button.submit-btn "Save Changes"
**Selector:** .user-form > .actions > button.submit-btn
**Component:** <App> → <SettingsView> → <UserForm> → <PButton>
**SFC Path:** src/views/settings/UserForm.vue
**Pinia Stores:** userStore, settingsStore
**Route:** /settings/profile

**Feedback:** Button stays active during loading state
**Expected:** Button disabled + spinner while saving
**Actual:** Triggers duplicate API calls on double-click
```

## Production Guard

VuePoint automatically disables itself in production:

- When `NODE_ENV === 'production'`
- When `import.meta.env.PROD === true`

No code stripping or conditional imports needed.

## Annotation Modes

VuePoint supports several annotation modes beyond single-element click:

| Mode | Trigger | Use Case |
|------|---------|----------|
| **Click** | Click element | Annotate a single element |
| **Multi-select** | <kbd>Shift</kbd>+Drag | Select multiple related elements |
| **Area select** | <kbd>Alt</kbd>+Drag | Annotate layout/spacing (no specific element) |
| **Text select** | Select text, then click toolbar | Flag copy issues or typos |

## Next Steps

- [Configuration](/guide/configuration) — Customize shortcuts, Pinia integration, and more
- [MCP Integration](/guide/mcp-integration) — Connect AI agents via Model Context Protocol
- [Webhooks](/guide/webhooks) — Push annotations to Slack, Linear, or Jira
- [REST API](/reference/rest-api) — Programmatic access to annotations
