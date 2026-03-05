# Design: @vuepoint/storybook — Storybook 8 Preset

**Date:** 2026-03-05
**Status:** Approved

## Goal

Let teams add VuePoint annotations to their Storybook 8 (Vue 3) with one line in `.storybook/main.ts`.

## Architecture

A Storybook preset package that auto-registers a Vue decorator and injects VuePoint CSS. No Storybook toolbar UI — VuePoint's own FAB handles everything.

### Package Structure

```
packages/storybook/
├── src/
│   ├── preset.ts        # Storybook preset entry — registers decorator
│   ├── decorator.ts     # Vue decorator — wraps each story with app.use(VuePoint)
│   └── index.ts         # Re-export for direct import
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### How It Works

1. **Preset (`preset.ts`)** — Storybook auto-discovers via addons list. Registers the decorator globally.
2. **Decorator (`decorator.ts`)** — Uses Storybook 8's `setup()` hook from `@storybook/vue3` to call `app.use(VuePoint, { enabled: true })` on the preview Vue app. Called once at initialization.

### Consumer Setup

```ts
// .storybook/main.ts
export default {
  addons: ['@vuepoint/storybook'],
}
```

### Dependencies

- `peerDependencies`: `@storybook/vue3 ^8.0.0`, `@vuepoint/vue ^0.1.0`
- No runtime dependencies

### Decisions

- **Always-on** — no toggle, VuePoint FAB is the UI
- **No per-story config** — applies globally
- **No Storybook panel** — annotations live in VuePoint's own overlay
- **Preset, not full addon** — lighter, avoids redundant Storybook toolbar button

### Distribution

New package in monorepo, tarball in GitHub release, same pattern as other @vuepoint/* packages.
