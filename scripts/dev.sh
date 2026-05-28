#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# ── env check ────────────────────────────────────────────────────────────────

if [[ ! -f .env.local ]]; then
  echo "✗  .env.local not found"
  echo "   Create it with the four VITE_FIREBASE_* keys (see CLAUDE.md)"
  exit 1
fi

required=(
  VITE_FIREBASE_API_KEY
  VITE_FIREBASE_AUTH_DOMAIN
  VITE_FIREBASE_PROJECT_ID
  VITE_FIREBASE_APP_ID
)

missing=()
for var in "${required[@]}"; do
  val=$(grep -E "^${var}=" .env.local 2>/dev/null | cut -d= -f2-)
  [[ -z "$val" ]] && missing+=("$var")
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "✗  missing or empty in .env.local:"
  for v in "${missing[@]}"; do echo "     $v"; done
  exit 1
fi

echo "✓  environment OK"

# ── install ───────────────────────────────────────────────────────────────────

if [[ ! -d node_modules ]]; then
  echo "→  installing dependencies…"
  npm install
fi

# ── dev server ────────────────────────────────────────────────────────────────

echo "→  starting dev server"
npm run dev
