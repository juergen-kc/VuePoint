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
