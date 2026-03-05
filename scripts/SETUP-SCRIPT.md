# setup-vuepoint.sh

Idempotent bash script that automates VuePoint installation into [circuit-playground](https://github.com/AmpJC/circuit-playground) on macOS. Safe to re-run — every phase checks preconditions before acting.

## Quick Start

From inside the `circuit-playground` directory:

```bash
gh release download v0.1.0 --repo juergen-kc/VuePoint --pattern 'setup-vuepoint.sh'
chmod +x setup-vuepoint.sh
./setup-vuepoint.sh
```

## Prerequisites

| Requirement | Why |
|---|---|
| **Node >= 18** | Runtime for Vue 3 + Vite toolchain |
| **pnpm >= 10** | Package manager used by circuit-playground |
| **gh CLI** (authenticated) | Downloads pre-built tarballs from a private GitHub Release |
| **CodeArtifact auth** | circuit-playground's `@jumpcloud/*` packages resolve from AWS CodeArtifact |

The script validates all of these in Phase 1 and exits with a clear error message if anything is missing.

## What the Script Does

### Phase 1 — Preflight Checks

Verifies the working directory is circuit-playground (looks for `@jumpcloud/circuit` in `package.json`) and validates all prerequisites listed above. Fails fast with actionable error messages.

### Phase 2 — Download Tarballs

Downloads four pre-built `.tgz` packages from the GitHub Release (`v0.1.0`) into a `.vuepoint/` directory:

| Tarball | Package | Purpose |
|---|---|---|
| `vuepoint-core-0.1.0.tgz` | `@vuepoint/core` | Types, CSS selector generation, formatters |
| `vuepoint-vue-0.1.0.tgz` | `@vuepoint/vue` | Vue 3 plugin, annotation toolbar UI, composables |
| `vite-plugin-vuepoint-0.1.0.tgz` | `vite-plugin-vuepoint` | Zero-config Vite integration (auto-injects VuePoint in dev) |
| `vuepoint-mcp-0.1.0.tgz` | `@vuepoint/mcp` | MCP server for AI agent integration |

Adds `.vuepoint/` to `.gitignore` if not already present. Skips download if all tarballs already exist.

### Phase 3 — Install Dependencies

This is the most nuanced phase. VuePoint's packages were built in a pnpm workspace where inter-package dependencies use `workspace:*` references. In the published tarballs, these become concrete version numbers (e.g., `^0.1.0`), but none of the `@vuepoint/*` packages are published to npm — so pnpm can't resolve them from a registry.

**The fix: `pnpm.overrides`**

Before running `pnpm add`, the script patches `package.json` with three overrides that redirect pnpm to the local tarballs:

```json
{
  "pnpm": {
    "overrides": {
      "@vuepoint/core": "file:.vuepoint/vuepoint-core-0.1.0.tgz",
      "@vuepoint/bridge": "file:.vuepoint/vuepoint-core-0.1.0.tgz",
      "@vuepoint/vue": "file:.vuepoint/vuepoint-vue-0.1.0.tgz"
    }
  }
}
```

Why each override exists:

- **`@vuepoint/core`** — depended on by `@vuepoint/vue` and `vite-plugin-vuepoint`
- **`@vuepoint/bridge`** — depended on by `@vuepoint/vue`. The bridge package is bundled inside `@vuepoint/core`'s tarball (it re-exports from core), so the override points to the core tarball
- **`@vuepoint/vue`** — depended on by `vite-plugin-vuepoint`

The overrides **must** be set before `pnpm add` because pnpm resolves all transitive dependencies at add time. Setting them after would leave unresolved packages in the lockfile.

After patching, the script runs:
1. `pnpm add` for the three runtime packages (core, vue, vite-plugin)
2. `pnpm add -D` for the MCP server (dev dependency only)
3. `pnpm install` to resolve everything

The idempotency check verifies all three packages exist in both `package.json` **and** `node_modules/` — a partial prior run might have added entries to `package.json` without completing the install.

### Phase 4 — Create App Shell

Creates three files if they don't already exist:

**`index.html`** — Vite entry point with `data-theme="circuit-light"` for Circuit DS theming.

**`src/main.ts`** — Vue app bootstrap that:
- Configures PrimeVue with Circuit's preset (`@jumpcloud/circuit/primevue`)
- Registers `ToastService` and `Tooltip` directive (common Circuit patterns)
- VuePoint is auto-injected by `vite-plugin-vuepoint` (CSS included) — no manual imports needed

**`src/App.vue`** — Minimal shell using Circuit's `TopBar` and `ListPageLayout` components with sample buttons for immediate visual testing.

### Phase 5 — Patch vite.config.ts

Adds the `vite-plugin-vuepoint` import and `vuePoint()` plugin call to the existing Vite config. Uses `node -e` with `fs.readFileSync/writeFileSync` for file manipulation (avoids macOS BSD `sed` compatibility issues).

The Vite plugin auto-injects VuePoint into any entry file that calls `createApp()` — useful for existing projects that already have a `main.ts`. Since the setup script creates `main.ts` with VuePoint already registered, the plugin serves as a safety net here.

### Phase 6 — Add Dev Script

Adds `"dev": "vite"` to `package.json` scripts if not already present.

### Phase 7 — Done

Prints a success banner with next steps. **Does not delete `.vuepoint/`** — the tarballs must persist because `pnpm.overrides` references them via `file:` protocol. Deleting them would break any future `pnpm install`.

## Idempotency

Every phase is guarded:

| Phase | Guard |
|---|---|
| Tarball download | Checks if all `.tgz` files exist in `.vuepoint/` |
| Overrides patch | Checks if all three `file:` overrides are present in `package.json` |
| Package install | Checks `package.json` entries **and** `node_modules/` directories |
| App shell files | Checks if `index.html`, `src/main.ts`, `src/App.vue` exist |
| Vite config | Greps for `vite-plugin-vuepoint` in `vite.config.ts` |
| Dev script | Checks if `scripts.dev` exists in `package.json` |

Re-running the script after a successful install produces all "skipped" messages and exits cleanly.

## Troubleshooting

| Error | Fix |
|---|---|
| `No package.json found` | Run from inside the circuit-playground directory |
| `no @jumpcloud/circuit dependency` | Wrong directory — this script targets circuit-playground specifically |
| `pnpm >= 10 required` | `corepack enable && corepack prepare pnpm@latest --activate` |
| `gh CLI not authenticated` | `gh auth login` |
| `CodeArtifact not configured` | Run your team's `aws codeartifact login` command |
| `Failed to download tarballs` | Check `gh auth status` and that you have access to `juergen-kc/VuePoint` |
| `pnpm add failed` with 401 | CodeArtifact token expired — re-run `aws codeartifact login` |
| Toolbar not visible after `pnpm dev` | Hard-refresh the browser (`Cmd+Shift+R`) — Vite may cache stale pre-bundled deps |

## Files Created / Modified

In the circuit-playground directory:

| Path | Action | Purpose |
|---|---|---|
| `.vuepoint/*.tgz` | Created | Pre-built VuePoint packages (gitignored) |
| `.gitignore` | Appended | Adds `.vuepoint/` entry |
| `package.json` | Patched | Adds dependencies + `pnpm.overrides` + dev script |
| `pnpm-lock.yaml` | Updated | Lock file updated by `pnpm install` |
| `index.html` | Created | Vite entry point |
| `src/main.ts` | Created | Vue app bootstrap with VuePoint |
| `src/App.vue` | Created | Minimal Circuit DS shell |
| `vite.config.ts` | Patched | Adds vuePoint() plugin |

## Upgrading

To upgrade to a new VuePoint version:

1. Update `VUEPOINT_VERSION` at the top of the script (or download the new version of the script)
2. Delete `.vuepoint/` to force re-download
3. Re-run the script — it will download new tarballs and update dependencies
