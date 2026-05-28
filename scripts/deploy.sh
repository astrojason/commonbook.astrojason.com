#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# ── tests ─────────────────────────────────────────────────────────────────────

echo "→  running tests…"
npm run test -- run

# ── build ─────────────────────────────────────────────────────────────────────

echo "→  building…"
npm run build

# ── vercel env check ──────────────────────────────────────────────────────────

echo "→  checking Vercel environment…"

if ! vercel env ls production 2>/dev/null | grep -q "OPENAI_API_KEY"; then
  echo ""
  echo "⚠   OPENAI_API_KEY is not set in Vercel production"
  echo "    AI sessions will return 500 errors until it is added."
  echo "    Add it now:  vercel env add OPENAI_API_KEY production"
  echo ""
  read -rp "    Deploy anyway? (y/N): " ok
  [[ "$ok" == "y" || "$ok" == "Y" ]] || exit 1
fi

# ── deploy ────────────────────────────────────────────────────────────────────

echo "→  deploying to Vercel (production)…"
vercel --prod
