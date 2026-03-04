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
