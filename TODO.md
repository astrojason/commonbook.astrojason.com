## Setup / follow-up (manual — needs Jason)

- [ ] Deploy the latest code to Vercel (nothing pushed/deployed yet — this session's changes are local only)
- [ ] Set new Vercel env vars: `FIREBASE_SERVICE_ACCOUNT_KEY` (service account JSON for the `recall-4899d` Firebase project), `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (same Turso DB articles.astrojason.com's backend uses), `SCRAPER_API_KEY` (same key articles.astrojason.com uses) — see CLAUDE.md's Environment Variables section
- [ ] Run `npm run bootstrap-superadmin` locally (with `FIREBASE_SERVICE_ACCOUNT_KEY` set) to grant `jason@astrojason.com` SUPERADMIN — until this runs, every account (including yours) is PENDING and locked out
- [ ] Paste `firestore.rules` into the Firebase console for the `recall-4899d` project (Firestore Database → Rules → Publish) — not deployed automatically
- [ ] In Settings, set `articlesAppUid` to `7Uy03f2TFBZKGY0RLsizi7Y1XOF3` (the owner UID Daily Read's backend uses for all article/read data — confirmed in `articles.astrojason.com/backend/internal/handlers/articles.go`)
- [ ] In Settings, add at least one interest keyword — Discover shows nothing until you do (by design, never falls back to "all unread")
- [ ] When ready to move off the old domain: follow `CUTOVER.md` (custom domain, DNS, Firebase authorized domains) — deliberately not automated

## Bugs

## Features
- [x] Rename Recall to commonbook (code-level; live domain cutover is a separate deliberate step — see CUTOVER.md)
- [x] PENDING/USER/ADMIN/SUPERADMIN role system, gating all routes behind approval (`/admin` panel for role changes, `scripts/bootstrap-superadmin.ts` seeds the fixed SUPERADMIN)
- [x] Settings screen — per-user `articlesAppUid` and `interestKeywords`
- [x] Discover — direct Turso DB read/write against articles.astrojason.com's shared DB, keyword-filtered unread feed with search/category narrowing
- [x] Full-text ingestion at promote-time (tiered scrape + manual-paste fallback), persisted back to `article.content`
- [x] `/api/draft-note` — AI-drafted note fields from an article, pre-filling Capture (fully editable before save)

## Enhancements
- [x] in the list view show the last time reviewed in addtion to when the article/note was added