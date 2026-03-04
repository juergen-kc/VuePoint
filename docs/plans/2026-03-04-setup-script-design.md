# Design: VuePoint Setup Script for Circuit Playground

## Goal

A single bash script (`setup-vuepoint.sh`) that automates VuePoint installation into circuit-playground on macOS. Idempotent — safe to re-run for upgrades or after partial failures.

## Constraints

- Target: macOS (zsh/bash), circuit-playground with @jumpcloud/circuit + PrimeVue
- Pre-built tarballs hosted on GitHub Releases (juergen-kc/VuePoint)
- User runs from inside the circuit-playground directory
- No external dependencies beyond Node >= 18, pnpm >= 10, gh CLI

## Script Flow

```
setup-vuepoint.sh
│
├── 1. Preflight checks
│   ├── Verify current dir is circuit-playground (package.json has @jumpcloud/circuit)
│   ├── node >= 18
│   ├── pnpm >= 10
│   ├── gh CLI installed + authenticated to GitHub
│   └── CodeArtifact auth valid (npm config get @jumpcloud:registry returns URL)
│
├── 2. Download tarballs from GitHub Releases
│   ├── gh release download v0.1.0 --repo juergen-kc/VuePoint
│   ├── Assets: vuepoint-core-0.1.0.tgz, vuepoint-vue-0.1.0.tgz,
│   │          vite-plugin-vuepoint-0.1.0.tgz, vuepoint-mcp-0.1.0.tgz
│   └── Into .vuepoint/ temp directory (gitignored)
│
├── 3. Install dependencies
│   ├── pnpm add ./tarballs (core, vue, vite-plugin)
│   ├── pnpm add -D ./tarballs (mcp)
│   ├── Patch package.json: add pnpm.overrides { "@vuepoint/bridge": "npm:@vuepoint/core@0.1.0" }
│   └── pnpm install
│
├── 4. Create app shell (skip if files exist)
│   ├── index.html — Vite entry with data-theme="circuit-light"
│   ├── src/main.ts — createApp + PrimeVue/Circuit config + VuePoint CSS import
│   └── src/App.vue — TopBar + ListPageLayout + sample buttons
│
├── 5. Patch vite.config.ts
│   └── Add vuePoint() import + plugin entry (grep guard: skip if already present)
│
├── 6. Patch package.json scripts
│   └── Add "dev": "vite" if not present
│
└── 7. Done
    ├── Clean up .vuepoint/ temp dir
    └── Print success message with next steps
```

## Design Decisions

### JSON patching
Use `node -e` inline for package.json modifications. Everyone has Node, avoids jq dependency. Reads file, manipulates with JS, writes back.

### TypeScript file patching
Use `grep -q` to check if already patched, `sed` to insert import/plugin lines at known positions. The vite.config.ts has a predictable structure (defineConfig + plugins array).

### Idempotency
Every step checks preconditions:
- Tarballs: skip download if .vuepoint/*.tgz exist with correct size
- Dependencies: skip pnpm add if @vuepoint/vue already in package.json
- Files: skip creation if index.html/main.ts/App.vue exist
- Patches: grep guard before sed operations

### Error handling
- `set -euo pipefail` — stop on first error
- Clear error message at each step explaining what failed and how to fix
- No rollback on failure — partial state is fine since re-run is idempotent

### Version pinning
Script has a `VUEPOINT_VERSION` variable at the top (default: "v0.1.0"). To upgrade, change the version and re-run — tarballs re-download, pnpm re-installs.

## File Locations

- Script: `scripts/setup-vuepoint.sh` in the VuePoint repo (also downloadable via curl)
- Temp dir: `.vuepoint/` in circuit-playground (add to .gitignore)
- App shell files: `index.html`, `src/main.ts`, `src/App.vue` in circuit-playground root

## Distribution

Team members run:
```bash
curl -fsSL https://raw.githubusercontent.com/juergen-kc/VuePoint/main/scripts/setup-vuepoint.sh | bash
```

Or download and run:
```bash
gh release download v0.1.0 --repo juergen-kc/VuePoint --pattern 'setup-vuepoint.sh'
chmod +x setup-vuepoint.sh
./setup-vuepoint.sh
```
