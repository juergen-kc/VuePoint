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
- Build: `vite-plugin-dts` (with `rollupTypes: true`) for declaration bundling; `@vitejs/plugin-vue` for SFC compilation
- Build: `packages/vue/tsconfig.build.json` with empty `paths: {}` prevents DTS from following `@vuepoint/core` source
- Build: MCP and API packages are ESM-only (no CJS) since they're Node.js CLI entry points
- Build: `exports` field in package.json must list `types` before `import`/`require`

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

## 2026-03-04 - US-002
- Created `vite.config.ts` in all 4 publishable packages: core, vue, mcp, api
- @vuepoint/core: Vite library mode → ESM (`index.js`) + CJS (`index.cjs`) + declarations (`index.d.ts`)
- @vuepoint/vue: Vite library mode + `@vitejs/plugin-vue` for SFC compilation → ESM + CJS + dts + CSS
- @vuepoint/mcp: Vite library mode targeting Node 18 → ESM entry point (`server.js`)
- @vuepoint/api: Vite library mode targeting Node 18 → ESM entry point (`api.js`)
- Added `vite-plugin-dts` and `@vitejs/plugin-vue` as root devDeps
- Added `vite` devDep to core, mcp, api packages
- Created `tsconfig.build.json` for vue package (empty `paths` to avoid DTS rootDir errors)
- Fixed `exports` field ordering in core and vue package.json (`types` first)
- Updated all build scripts from placeholder `echo` to `vite build`
- `pnpm build` succeeds; `pnpm typecheck` passes clean
- Files changed: 4 new vite.config.ts, 1 new tsconfig.build.json, 6 modified package.json, pnpm-lock.yaml
- **Learnings for future iterations:**
  - `vite-plugin-dts` follows tsconfig `paths` and will try to generate declarations for cross-package sources — use a separate `tsconfig.build.json` with empty `paths` to prevent this
  - `rollupTypes: true` in vite-plugin-dts produces a single bundled `.d.ts` file (uses @microsoft/api-extractor under the hood)
  - MCP and API packages use top-level `await` so must be ESM-only (no CJS output)
  - pnpm `-r` automatically handles build order based on workspace dependency topology
---
