# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project

commonbook is a personal PWA for knowledge retention — capture notes, reinforce them with AI quiz sessions, surface them on a spaced repetition schedule, and discover new ideas from your own saved reading via articles.astrojason.com. Access is gated by role (PENDING/USER/ADMIN/SUPERADMIN); only approved accounts get in.

---

## Tech Stack

- **Frontend:** React (Vite) + TypeScript + Tailwind CSS + vite-plugin-pwa
- **Database/Auth:** Firebase Firestore + Firebase Auth (Google sign-in)
- **AI:** OpenAI `gpt-4o-mini` — proxied through a Vercel serverless function (`/api/chat`); key never in client bundle
- **Deployment:** Vercel
- **Testing:** Vitest + React Testing Library

---

## Commands

```bash
npm run dev       # start dev server
npm run build     # production build
npm run preview   # preview production build locally
npm run lint      # lint
npm run test      # run tests (Vitest)
npm run test:ui   # Vitest UI
```

## Development workflow

TDD: write a failing test for the bug or feature first, then implement until the test passes.

A task is not done until:
1. All tests pass (`npm run test`)
2. The build passes (`npm run build`)
3. Progress is recorded:
   - **PLAN.md** — strikethrough the completed stage heading (e.g. `~~## Stage 1 — Project Scaffold~~`)
   - **TODO.md** — check off the corresponding item (e.g. `- [x] Stage 1 — Project Scaffold`); create the file if it doesn't exist

---

## Error handling

Nothing is allowed to fail silently. Every async operation that can throw must catch the error and surface it in the UI. The full error message must be displayed in a block that the user can copy (e.g. a `<pre>` or a selectable text node), not just a vague "something went wrong" string.

---

## Environment Variables

### Server-side (Vercel only — never `VITE_` prefixed)
```
OPENAI_API_KEY
FIREBASE_SERVICE_ACCOUNT_KEY   # JSON service account for the recall-4899d project, used by /api/admin/set-role and scripts/bootstrap-superadmin.ts
TURSO_DATABASE_URL             # same Turso DB articles.astrojason.com's backend uses — read/write directly, no HTTP call into that app
TURSO_AUTH_TOKEN
SCRAPER_API_KEY                # ScraperAPI fallback tier for full-text scraping at promote-time (see lib/scrapeArticle.ts)
```

### Client-side (Vite, safe to expose)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
```

---

## Architecture

### Data flow

The client talks directly to Firestore and Firebase Auth. OpenAI is the only call that goes through a server — the Vercel function at `/api/chat` builds the system prompt server-side and proxies the stream back to the client. The token tracker (`INTEGRATION.md`) is called directly from the client.

### Firestore schema

**`notes/{noteId}`** — core entity with all SM-2 state inline (`interval_days`, `easiness_factor`, `session_count`, `next_review_at`, `last_rating`). Soft-deleted via `deleted_at` timestamp — filter `deleted_at == null` on every notes query.

**`sessions/{sessionId}`** — full message history per session. Sessions are per-note and per-lifetime (not per-date). A session with `completed_at: null` is incomplete and should be resumed, not replaced.

**`meta/stats`** — single doc with running totals: `total_sessions`, `passing_sessions`, `total_notes`. Updated client-side alongside note/session writes. Used for dashboard stats.

**`users/{uid}`** — one doc per commonbook account, created on first sign-in via `ensureUserDoc` (`src/lib/users.ts`). Fields: `email`, `displayName`, `role` (`'PENDING' | 'USER' | 'ADMIN' | 'SUPERADMIN'`, mirrors the Firebase custom claim of the same name), `articlesAppUid` (this person's UID in the separate articles-245214 Firebase project, set via Settings), `interestKeywords` (string list, used to filter the Discover feed), `createdAt`.

### Role system

New sign-ins get no `role` custom claim, treated as `PENDING` — locked out of every route by `RequireAuth` (`src/components/RequireAuth.tsx`), which shows a static "pending approval" screen instead. `RequireAdmin` (`src/components/RequireAdmin.tsx`) additionally gates `/admin` to `ADMIN`/`SUPERADMIN` only.

`SUPERADMIN` is fixed to `jason@astrojason.com`, seeded once via `scripts/bootstrap-superadmin.ts` (run locally with `FIREBASE_SERVICE_ACCOUNT_KEY` set) — no one can reassign or remove it through the app. All other role changes (`PENDING → USER`, `USER ↔ ADMIN`) happen through the `/admin` panel, which calls `/api/admin/set-role`: that function verifies the caller's ID token is `ADMIN`/`SUPERADMIN`, rejects any request targeting the SUPERADMIN account or attempting to grant it, then calls `setCustomUserClaims` and mirrors the new role into `users/{uid}.role`.

A user whose role just changed needs a forced token refresh to see it — `useAuth().refreshRole()` (calls `getIdTokenResult(true)`), exposed as a "Check again" button on the pending-approval screen.

Firestore security rules should enforce `request.auth.token.role in ['USER','ADMIN','SUPERADMIN']` on `notes`/`sessions`/`meta` reads and writes, and restrict writes to `users/{uid}.role` to admins only. `firestore.rules` in this repo has the recommended rules, but it is **not** currently wired up to deploy (no `firebase.json` referencing it, rules are console-configured today) — copy its contents into the Firebase console (recall-4899d project → Firestore → Rules) manually.

### SM-2 algorithm

Pure function — lives in one place, called on self-rating submit (rating without a completed session is not allowed):

```
if rating < 3:
  interval_days = 1
  EF = max(1.3, EF - 0.2)
else:
  if session_count == 0: interval = 1
  if session_count == 1: interval = 6
  else: interval = round(interval_days * EF)
  EF = EF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  EF = max(1.3, EF)

next_review_at = now + interval_days
session_count++
```

### AI session flow

1. Before starting: `GET https://token-tracker-roan.vercel.app/api/tokens`. Two states:
   - **Under 250k** (or endpoint unreachable): proceed silently
   - **At or over 250k**: show a soft-gate confirmation — "You've used Xk tokens today. Continue anyway?" User can proceed or cancel. Never a hard block. (See `INTEGRATION.md`.)
2. Client POSTs `{ sessionId, noteContext, messages }` to `/api/chat`.
3. Vercel function injects note fields into system prompt, calls OpenAI with `stream: true, stream_options: { include_usage: true }`, pipes SSE stream back.
4. Client appends chunks to UI; after full assistant response, writes updated `messages` to the session doc in Firestore.
5. Client reads the final usage chunk and POSTs `input_tokens + output_tokens` to the token tracker.
6. On `SESSION_COMPLETE` sentinel: navigate to `/note/:id` with router state `{ sessionComplete: true, sessionId }`.
7. Note detail unlocks self-rating UI on that router state. On submit: run SM-2, write note + session doc + `meta/stats`.

### Discover (articles.astrojason.com integration)

commonbook reads and writes **directly** against articles.astrojason.com's shared Turso/libSQL DB (`api/_lib/turso.ts`) — no HTTP call into that app's Go backend. The schema mirrors the queries in `articles.astrojason.com/backend/internal/handlers/{library,read,categories}.go`: `article` (`id, title, url, summary, reading_time, search_terms` as a JSON array string, `content, created_by_uid, created_timestamp`), `user_article_read` (`article_id, created_by_uid, ...`), `user_article_category` (`id, name, created_by_uid`), `user_article_category_article` (join table).

Since commonbook (`recall-4899d`) and articles.astrojason.com (`articles-245214`) are separate Firebase projects, there's no shared UID — each commonbook user stores their own `articlesAppUid` in Settings (the UID whose rows they want to read/write in that DB; today that's the hardcoded `ownerUID` constant in `articles.astrojason.com/backend/internal/handlers/articles.go`).

`GET /api/discover/feed` — verifies the caller's Firebase ID token has app access (USER/ADMIN/SUPERADMIN), then returns unread articles for `articlesAppUid` matching at least one of the caller-supplied `keywords` against `search_terms` (empty keyword list ⇒ empty result, by design — Discover never falls back to "all unread"), optionally narrowed by free-text `search` or a `category`. Also returns the full category list for that uid.

`POST /api/discover/mark-read` — same auth gate, inserts a `user_article_read` row for `{ articlesAppUid, articleId }` if one doesn't already exist (idempotent). Used both for "skip" and after a card is promoted into a note.

`POST /api/discover/ingest` — ensures full article text is available for drafting: uses `pastedContent` if supplied (manual fallback), otherwise runs `api/_lib/scrapeArticle.ts`'s tiered scraper (direct fetch → Jina Reader → ScraperAPI, `SCRAPER_API_KEY`) against `url`. On success, persists the text into `article.content` (direct DB write) so it's never re-fetched. Returns `422` when scraping fails and no `pastedContent` was given — the client shows a manual-paste textarea instead of treating it as a hard error.

`POST /api/draft-note` — given an article's title + full content (falling back to `summary` if content is unavailable), asks OpenAI (`gpt-4o-mini`, JSON mode) to draft `{ tag, what_it_said, why_it_matters, application }`. The Discover screen's Promote action uses this to pre-fill `/capture` via router state (`navigate('/capture', { state: { prefill: {...} } })`) — Capture reads `location.state.prefill` as its initial values, fully editable before the existing Save action runs.

### Routing

| Route | Purpose |
|---|---|
| `/login` | Google sign-in — redirected here when unauthenticated |
| `/` | Dashboard — due notes, recent notes, stats |
| `/capture` | New note form (also handles edit via `?edit=:id`, or a Discover promote via `location.state.prefill`) |
| `/note/:id` | Note detail, session resume, self-rating |
| `/session/:sessionId` | Active chat session |
| `/library` | All notes — filter by tag, search by title/tag |
| `/discover` | Browse unread articles.astrojason.com articles matching your interest keywords; skip or promote into a note |
| `/settings` | Per-user `articlesAppUid` and `interestKeywords` |
| `/admin` | ADMIN/SUPERADMIN only — approve/promote/demote accounts |

### Design system

The `design/recall_extracted/Recall.html` file is a fully interactive prototype of all five screens — open it in a browser to see exact layouts and interactions.

**CSS custom properties:**
```css
--ink:        #0E0C09   /* darkest bg */
--ink-2:      #161310   /* card/hover bg */
--ink-3:      #1C1814   /* selected state bg */
--rule:       #26211B   /* primary border */
--rule-2:     #332D25   /* secondary border */
--text:       #E8E2D1   /* primary text */
--muted:      #857C6E   /* secondary text */
--dim:        #4D4740   /* de-emphasized text */
--accent:     #E2602B   /* orange — the only color */
--accent-dim: #8a3a18
```

**Typography:** IBM Plex Sans (UI chrome) + IBM Plex Mono (note content, labels, timestamps, all textareas). Labels/tags: `font-mono text-[10px] uppercase tracking-[0.18em]`.

**Shared components:**
- `StrengthBar` — 5 filled/unfilled 2px segments; labels: `cold / cool / warm / hot / solid`; maps to `last_rating` on the note
- `Tag` — mono 10px muted uppercase
- `Chip` — mono 10px bordered badge, accent-filled when active
- `Rule` — 1px full-width divider; dashed variant uses `background-image` linear-gradient (not `border-style: dashed`)

**Layout:** 390×800px mobile frame. Fixed status bar + brand bar top, scrollable body, bottom tab nav.

**Design constraints:** No gradients. No purple. Accent orange is the only color. All note body content in IBM Plex Mono.
