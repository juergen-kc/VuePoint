# Configuration

Pass options to `app.use(VuePoint, { ... })` to customize behavior.

## Full Options Reference

```ts
import VuePoint from '@vuepoint/vue'
import { createPinia } from 'pinia'

const pinia = createPinia()

app.use(VuePoint, {
  // Master switch (auto-disabled in production)
  enabled: true,

  // Keyboard shortcut to toggle toolbar (default: 'ctrl+shift+a')
  shortcut: 'ctrl+shift+a',

  // Component filtering — hides library internals from component chain
  // false = no filtering, string[] = custom list, undefined = PrimeVue defaults
  filterComponents: undefined,

  // Pinia store resolution per annotation
  pinia: {
    enabled: true,
    instance: pinia,  // pass your Pinia instance
  },

  // MCP bridge (SharedWorker ↔ MCP server)
  mcp: {
    enabled: true,
    port: 3741,           // bridge HTTP port
    authToken: 'secret',  // optional Bearer token
  },

  // REST API server
  api: {
    enabled: true,
    port: 3742,
    authToken: 'secret',
    cors: ['http://localhost:3000'],
  },

  // Screenshot capture (opt-in for performance)
  screenshot: {
    enabled: false,
  },

  // Outbound webhooks
  webhooks: [
    {
      url: 'https://hooks.slack.com/services/T.../B.../xxx',
      secret: 'whsec_...',
      events: ['annotation.created', 'annotation.resolved'],
    },
  ],

  // App metadata included in webhook payloads
  appMeta: {
    name: 'My App',
    version: '1.0.0',
  },
})
```

## Component Filtering

By default, VuePoint filters out 35+ PrimeVue internal components (e.g., `PButton`, `PDialog`) and Vue built-ins (`Transition`, `KeepAlive`, `Suspense`) from the component chain. This keeps the chain focused on your own components.

```ts
// Use default PrimeVue + Vue built-in filters
app.use(VuePoint) // filterComponents defaults to PrimeVue list

// Disable all filtering
app.use(VuePoint, { filterComponents: false })

// Custom filter list
app.use(VuePoint, {
  filterComponents: ['PButton', 'PDialog', 'BaseLayout'],
})
```

## Pinia Integration

When enabled, each annotation includes which Pinia stores the annotated component's setup function references:

```ts
import { createPinia } from 'pinia'

const pinia = createPinia()
app.use(pinia)
app.use(VuePoint, {
  pinia: { enabled: true, instance: pinia },
})
```

Annotations will then include a `piniaStores` field like `['userStore', 'settingsStore']`.

## Dark/Light Theme

VuePoint auto-detects your system theme via `prefers-color-scheme` and persists the preference in `localStorage`. A toggle switch in the toolbar header lets users switch manually.

## Animation Pause

The toolbar includes a "Pause Animations" toggle that injects:

```css
* {
  animation-play-state: paused !important;
  transition: none !important;
}
```

This freezes all CSS animations so you can annotate elements that are in motion.

## Keyboard Shortcut

The default shortcut <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> toggles toolbar visibility. Customize it with the `shortcut` option:

```ts
app.use(VuePoint, { shortcut: 'ctrl+shift+v' })
```

Supported modifiers: `ctrl`, `shift`, `alt`, `meta`.
