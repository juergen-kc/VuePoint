# Nuxt 3 Module

VuePoint provides a dedicated Nuxt 3 module that integrates with Nuxt's auto-import system and route metadata.

## Installation

```bash
pnpm add @jumpcloud/nuxt-vuepoint
```

## Configuration

Add the module to your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@jumpcloud/nuxt-vuepoint'],

  vuepoint: {
    enabled: true, // auto-disabled in production

    shortcut: 'ctrl+shift+a',

    pinia: {
      enabled: true,
    },

    mcp: {
      enabled: true,
      port: 3741,
    },

    api: {
      enabled: true,
      port: 3742,
    },

    webhooks: [
      {
        url: 'https://hooks.slack.com/services/T.../B.../xxx',
        events: ['annotation.created'],
      },
    ],

    appMeta: {
      name: 'My Nuxt App',
      version: '1.0.0',
    },
  },
})
```

## What the Module Does

The Nuxt module handles everything automatically:

1. **Auto-registers the VuePoint Vue plugin** — no need to modify your app entry or plugins directory
2. **Captures Nuxt route metadata** — layout name, middleware, and route params are included in the annotation context
3. **Production guard** — respects Nuxt's build system, disabled in `nuxt build` output
4. **Pinia integration** — automatically detects and passes the Nuxt Pinia instance when `pinia.enabled` is true

## Nuxt-Specific Context

When using the Nuxt module, `vuepoint_get_app_context` returns additional Nuxt metadata:

```json
{
  "route": "/users/123",
  "routeName": "users-id",
  "pageComponent": "UsersId",
  "piniaStores": ["userStore"],
  "layout": "default",
  "middleware": ["auth"]
}
```

## Production Behavior

The module is disabled in production by default. No code is shipped to your production bundle. This works with:

- `nuxt build` — production build
- `nuxt generate` — static generation
- Setting `vuepoint.enabled` to `false` explicitly
