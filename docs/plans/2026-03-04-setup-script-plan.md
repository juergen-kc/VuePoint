# setup-vuepoint.sh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A single idempotent bash script that automates VuePoint installation into circuit-playground on macOS.

**Architecture:** One bash script with 7 sequential phases. Each phase checks preconditions before acting (idempotent). JSON patching uses inline `node -e`. TS patching uses `grep` guards + `sed` insertion. Tarballs downloaded from GitHub Releases via `gh` CLI.

**Tech Stack:** Bash, Node.js (for JSON manipulation), gh CLI, pnpm

---

### Task 1: Create the script skeleton with preflight checks

**Files:**
- Create: `scripts/setup-vuepoint.sh`

**Step 1: Write the script with header, config vars, helpers, and preflight section**

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
VUEPOINT_VERSION="v0.1.0"
VUEPOINT_REPO="juergen-kc/VuePoint"
TARBALL_DIR=".vuepoint"

# Tarball filenames (must match GitHub Release assets)
TARBALLS=(
  "vuepoint-core-0.1.0.tgz"
  "vuepoint-vue-0.1.0.tgz"
  "vite-plugin-vuepoint-0.1.0.tgz"
  "vuepoint-mcp-0.1.0.tgz"
)

# ── Helpers ───────────────────────────────────────────────────────────────────
info()  { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
ok()    { printf '\033[1;32m ✓\033[0m  %s\n' "$1"; }
warn()  { printf '\033[1;33m ⚠\033[0m  %s\n' "$1"; }
fail()  { printf '\033[1;31m ✗\033[0m  %s\n' "$1" >&2; exit 1; }
skip()  { printf '\033[0;90m →  %s (skipped)\033[0m\n' "$1"; }

# ── Phase 1: Preflight checks ────────────────────────────────────────────────
info "Checking prerequisites..."

# Must be in circuit-playground
[[ -f package.json ]] || fail "No package.json found. Run this from inside circuit-playground."
grep -q '"@jumpcloud/circuit"' package.json || fail "This doesn't look like circuit-playground (no @jumpcloud/circuit dependency)."
ok "In circuit-playground directory"

# Node >= 18
NODE_VERSION=$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)
[[ -n "$NODE_VERSION" && "$NODE_VERSION" -ge 18 ]] || fail "Node >= 18 required (got: $(node -v 2>/dev/null || echo 'not installed'))"
ok "Node $(node -v)"

# pnpm >= 10
PNPM_VERSION=$(pnpm -v 2>/dev/null | cut -d. -f1)
[[ -n "$PNPM_VERSION" && "$PNPM_VERSION" -ge 10 ]] || fail "pnpm >= 10 required (got: $(pnpm -v 2>/dev/null || echo 'not installed'))"
ok "pnpm $(pnpm -v)"

# gh CLI installed and authenticated
command -v gh >/dev/null 2>&1 || fail "gh CLI not installed. Run: brew install gh"
gh auth status >/dev/null 2>&1 || fail "gh CLI not authenticated. Run: gh auth login"
ok "gh CLI authenticated"

# CodeArtifact registry configured
JC_REGISTRY=$(npm config get @jumpcloud:registry 2>/dev/null || echo "")
if [[ -z "$JC_REGISTRY" || "$JC_REGISTRY" == "undefined" ]]; then
  fail "CodeArtifact not configured. Run your team's 'aws codeartifact login' command first."
fi
ok "CodeArtifact registry: $JC_REGISTRY"

echo ""
```

**Step 2: Make executable and test preflight from VuePoint repo**

Run: `chmod +x scripts/setup-vuepoint.sh`

Test (should fail gracefully since we're not in circuit-playground):
Run: `./scripts/setup-vuepoint.sh`
Expected: Red error "This doesn't look like circuit-playground"

**Step 3: Commit**

```bash
git add scripts/setup-vuepoint.sh
git commit -m "feat: setup script — phase 1 preflight checks"
```

---

### Task 2: Add tarball download phase

**Files:**
- Modify: `scripts/setup-vuepoint.sh`

**Step 1: Add Phase 2 after the preflight section**

Append to the script:

```bash
# ── Phase 2: Download tarballs ────────────────────────────────────────────────
info "Downloading VuePoint ${VUEPOINT_VERSION} tarballs..."

mkdir -p "$TARBALL_DIR"

# Check if tarballs already exist
ALL_PRESENT=true
for tb in "${TARBALLS[@]}"; do
  [[ -f "$TARBALL_DIR/$tb" ]] || ALL_PRESENT=false
done

if $ALL_PRESENT; then
  skip "Tarballs already downloaded in $TARBALL_DIR/"
else
  gh release download "$VUEPOINT_VERSION" \
    --repo "$VUEPOINT_REPO" \
    --dir "$TARBALL_DIR" \
    --pattern '*.tgz' \
    --clobber \
    || fail "Failed to download tarballs. Check: gh auth status, repo access, release exists."

  # Verify all expected tarballs arrived
  for tb in "${TARBALLS[@]}"; do
    [[ -f "$TARBALL_DIR/$tb" ]] || fail "Missing tarball: $tb (check GitHub Release assets)"
  done
  ok "Downloaded ${#TARBALLS[@]} tarballs to $TARBALL_DIR/"
fi

# Gitignore the temp dir
if [[ -f .gitignore ]] && ! grep -q "^\.vuepoint" .gitignore; then
  echo ".vuepoint/" >> .gitignore
  ok "Added .vuepoint/ to .gitignore"
fi

echo ""
```

**Step 2: Commit**

```bash
git add scripts/setup-vuepoint.sh
git commit -m "feat: setup script — phase 2 tarball download"
```

---

### Task 3: Add dependency installation phase

**Files:**
- Modify: `scripts/setup-vuepoint.sh`

**Step 1: Add Phase 3 — install tarballs and patch package.json**

Append to the script:

```bash
# ── Phase 3: Install dependencies ─────────────────────────────────────────────
info "Installing VuePoint packages..."

# Check if already installed
if grep -q '"@vuepoint/vue"' package.json 2>/dev/null; then
  skip "@vuepoint/vue already in package.json"
else
  pnpm add \
    "./$TARBALL_DIR/vuepoint-core-0.1.0.tgz" \
    "./$TARBALL_DIR/vuepoint-vue-0.1.0.tgz" \
    "./$TARBALL_DIR/vite-plugin-vuepoint-0.1.0.tgz" \
    || fail "pnpm add failed. If you see a 401, re-run your CodeArtifact login."
  ok "Added @vuepoint/core, @vuepoint/vue, vite-plugin-vuepoint"
fi

# Install MCP server as devDependency
if grep -q '"@vuepoint/mcp"' package.json 2>/dev/null; then
  skip "@vuepoint/mcp already in package.json"
else
  pnpm add -D "./$TARBALL_DIR/vuepoint-mcp-0.1.0.tgz" \
    || fail "Failed to install @vuepoint/mcp"
  ok "Added @vuepoint/mcp (dev)"
fi

# Patch package.json: add pnpm.overrides for @vuepoint/bridge
if node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); process.exit(p.pnpm?.overrides?.['@vuepoint/bridge'] ? 0 : 1)" 2>/dev/null; then
  skip "pnpm.overrides for @vuepoint/bridge already set"
else
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (!pkg.pnpm) pkg.pnpm = {};
    if (!pkg.pnpm.overrides) pkg.pnpm.overrides = {};
    pkg.pnpm.overrides['@vuepoint/bridge'] = 'npm:@vuepoint/core@0.1.0';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  ok "Added pnpm.overrides for @vuepoint/bridge"
fi

# Run install to resolve everything
pnpm install || fail "pnpm install failed"
ok "Dependencies installed"

echo ""
```

**Step 2: Commit**

```bash
git add scripts/setup-vuepoint.sh
git commit -m "feat: setup script — phase 3 dependency installation"
```

---

### Task 4: Add app shell creation phase

**Files:**
- Modify: `scripts/setup-vuepoint.sh`

**Step 1: Add Phase 4 — create index.html, src/main.ts, src/App.vue**

Append to the script:

```bash
# ── Phase 4: Create app shell ─────────────────────────────────────────────────
info "Creating app shell..."

# index.html
if [[ -f index.html ]]; then
  skip "index.html already exists"
else
  cat > index.html << 'HTMLEOF'
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
HTMLEOF
  ok "Created index.html"
fi

# src/main.ts
if [[ -f src/main.ts ]]; then
  skip "src/main.ts already exists"
else
  cat > src/main.ts << 'TSEOF'
import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import circuitConfig from '@jumpcloud/circuit/primevue'
import App from './App.vue'
import './assets/main.css'
import '@vuepoint/vue/style.css'

const app = createApp(App)

app.use(PrimeVue, {
  ...circuitConfig,
  theme: 'none',
})
app.use(ToastService)
app.directive('tooltip', Tooltip)

app.config.globalProperties.$testId = (suffix: string) => suffix

app.mount('#app')
TSEOF
  ok "Created src/main.ts"
fi

# src/App.vue
if [[ -f src/App.vue ]]; then
  skip "src/App.vue already exists"
else
  cat > src/App.vue << 'VUEEOF'
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
VUEEOF
  ok "Created src/App.vue"
fi

echo ""
```

**Step 2: Commit**

```bash
git add scripts/setup-vuepoint.sh
git commit -m "feat: setup script — phase 4 app shell creation"
```

---

### Task 5: Add vite.config.ts patching and dev script phase

**Files:**
- Modify: `scripts/setup-vuepoint.sh`

**Step 1: Add Phase 5 (vite config) and Phase 6 (dev script)**

Append to the script:

```bash
# ── Phase 5: Patch vite.config.ts ─────────────────────────────────────────────
info "Configuring Vite..."

if grep -q 'vite-plugin-vuepoint' vite.config.ts 2>/dev/null; then
  skip "vite.config.ts already has vuePoint plugin"
else
  # Add import line after the last existing import
  sed -i '' '/^import.*from/!b;:a;n;/^import.*from/ba;i\
import vuePoint from '\''vite-plugin-vuepoint'\'';
' vite.config.ts

  # Add vuePoint() to the plugins array
  sed -i '' 's/plugins: \[/plugins: [vuePoint(), /' vite.config.ts

  ok "Added vuePoint plugin to vite.config.ts"
fi

# ── Phase 6: Add dev script ───────────────────────────────────────────────────
if node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); process.exit(p.scripts?.dev ? 0 : 1)" 2>/dev/null; then
  skip "\"dev\" script already exists in package.json"
else
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (!pkg.scripts) pkg.scripts = {};
    pkg.scripts.dev = 'vite';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  ok "Added \"dev\": \"vite\" script to package.json"
fi

echo ""
```

**Step 2: Commit**

```bash
git add scripts/setup-vuepoint.sh
git commit -m "feat: setup script — phase 5-6 vite config and dev script"
```

---

### Task 6: Add cleanup and success message

**Files:**
- Modify: `scripts/setup-vuepoint.sh`

**Step 1: Add Phase 7 — cleanup and done**

Append to the script:

```bash
# ── Phase 7: Done ─────────────────────────────────────────────────────────────
# Clean up tarballs
rm -rf "$TARBALL_DIR"

echo ""
printf '\033[1;32m══════════════════════════════════════════════════\033[0m\n'
printf '\033[1;32m  VuePoint installed successfully!\033[0m\n'
printf '\033[1;32m══════════════════════════════════════════════════\033[0m\n'
echo ""
echo "  Next steps:"
echo ""
echo "    1. Start the dev server:"
echo "       pnpm dev"
echo ""
echo "    2. Open the URL Vite prints (usually http://localhost:5173)"
echo ""
echo "    3. Click the \"Annotate\" button in the bottom-right corner"
echo ""
echo "    4. Click any element → describe the issue → submit"
echo ""
echo "    5. Click the clipboard icon to copy annotations for AI agents"
echo ""
echo "  Keyboard shortcut: Ctrl+Shift+A (Cmd+Shift+A on Mac)"
echo ""
echo "  Full guide: https://github.com/juergen-kc/VuePoint/blob/main/docs/guides/circuit-playground-setup.md"
echo ""
```

**Step 2: Commit**

```bash
git add scripts/setup-vuepoint.sh
git commit -m "feat: setup script — phase 7 cleanup and success message"
```

---

### Task 7: Test the full script end-to-end

**Step 1: Verify the script is valid bash**

Run: `bash -n scripts/setup-vuepoint.sh`
Expected: No output (syntax OK)

**Step 2: Attach script to the GitHub Release**

```bash
gh release upload v0.1.0 scripts/setup-vuepoint.sh --repo juergen-kc/VuePoint --clobber
```

**Step 3: Update the setup guide to reference the script**

Add a "Quick Setup (Automated)" section at the top of `docs/guides/circuit-playground-setup.md` before the manual steps.

**Step 4: Final commit and push**

```bash
git add scripts/setup-vuepoint.sh docs/guides/circuit-playground-setup.md
git commit -m "feat: complete setup-vuepoint.sh with GitHub Release distribution"
git push
```
