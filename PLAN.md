# Recall — Implementation Plan

Stages are ordered by dependency. Each stage should be fully tested and building cleanly before the next begins.

---

## ~~Stage 1 — Project Scaffold~~

Set up the base project with no app logic.

- Init Vite + React + TypeScript
- Install core dependencies: `react-router-dom`, `firebase`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`
- Install and configure Tailwind CSS
- Add IBM Plex Sans + IBM Plex Mono via Google Fonts
- Define CSS custom properties (`--ink`, `--accent`, etc.) in `index.css`
- Set up `.env.local` with all required env vars (see SPEC.md)
- Configure Vitest with jsdom environment
- Confirm: `npm run dev`, `npm run build`, `npm run test` all pass on empty project

---

## ~~Stage 2 — Auth & Route Guard~~

- Configure Firebase Auth (Google provider)
- `/login` screen — "Sign in with Google" button only
- Auth context/hook (`useAuth`) — exposes current user, loading state
- Route guard — unauthenticated users redirected to `/login` from any route
- Wire up React Router with placeholder screens for all 5 routes: `/`, `/capture`, `/note/:id`, `/session/:sessionId`, `/library`

**Tests:** auth context returns user after sign-in; unauthenticated redirect fires.

---

## ~~Stage 3 — Design System & App Shell~~

Build all shared primitives before any screen logic.

- Shared components: `Rule` (solid + dashed), `Tag`, `Chip`, `StrengthBar`
- App shell: status bar, brand bar (with current screen label), bottom tab nav
- Shell renders correct screen based on route; active nav item highlighted in accent

**Tests:** `StrengthBar` renders correct number of filled segments; `Chip` applies active styles; `Rule` dashed variant renders.

---

## ~~Stage 4 — Data Layer & SM-2~~

Pure logic and Firestore utilities — no UI.

- Firestore client setup (singleton)
- Note CRUD: `createNote`, `updateNote`, `softDeleteNote`, `getNoteById`, `subscribeToNotes` (filtered: `deleted_at == null`)
- Session CRUD: `createSession`, `updateSession`, `getIncompleteSession`
- Stats: `incrementStats`, `decrementNoteCount` — update `meta/stats` doc
- SM-2 function: pure function, takes `{ rating, intervalDays, easinessFactor, sessionCount }`, returns updated values
- Tag derivation: `getUniqueTags(notes: Note[])` — pure function

**Tests:** SM-2 function covers all branches (rating < 3, first session, second session, subsequent sessions, EF floor at 1.3). Tag derivation returns deduplicated sorted list.

---

## ~~Stage 5 — Capture & Edit~~

- Capture form: title, tag (with chip suggestions), source URL, 01/02/03 textareas
- On save: call `createNote`, update `meta/stats`, navigate to `/note/:id`
- Edit mode: same form pre-filled, triggered from note detail; on save calls `updateNote` (SM-2 fields untouched)
- Reuse the same `CaptureForm` component for both create and edit

**Tests:** form validates required fields; save calls `createNote` with correct shape; edit pre-fills and calls `updateNote`; SM-2 fields not modified on edit.

---

## ~~Stage 6 — Note Detail~~

- Display all note fields (title, tag, source URL, 01/02/03 body sections)
- Metadata grid: captured date, review count + next review, strength (`StrengthBar` from `last_rating`), status (due/upcoming)
- Edit button → navigate to `/capture?edit=:id`
- Delete button (with confirmation) → `softDeleteNote`, navigate to `/`
- "Start Session" button: query `getIncompleteSession(noteId)` — resume if found, else `createSession` and navigate
- Self-rating UI: locked by default; active only when router state contains `{ sessionComplete: true }`
  - On submit: run SM-2, write to note + session doc, update `meta/stats`

**Tests:** self-rating locked without router state; unlocked with it; SM-2 writes fire on submit; delete sets `deleted_at`; "Start Session" resumes existing incomplete session.

---

## ~~Stage 7 — Vercel API Function~~

- `api/chat.ts` — Vercel serverless function
- Receives `{ sessionId, noteContext, messages }`
- Builds system prompt server-side (note fields injected, never returned to client)
- Calls OpenAI `gpt-4o-mini` with `stream: true`, `stream_options: { include_usage: true }`
- Pipes SSE stream back to client, including the final usage chunk
- Returns appropriate HTTP errors for missing fields or OpenAI failures

**Tests:** function returns 400 for missing `noteContext`; system prompt contains injected note fields (mock OpenAI); usage chunk is forwarded.

---

## ~~Stage 8 — Session Screen~~

- Chat UI: message list (recall / me), streaming text display, input composer
- On load: check token limit (`GET` endpoint) before starting — show blocking confirmation if ≥ 250k, block if endpoint unreachable
- Each user message: POST to `/api/chat`, stream response into UI
- After each complete exchange: write updated `messages` array to Firestore
- After each exchange: POST token count from usage chunk to token endpoint
- Detect `SESSION_COMPLETE` in stream: hide input, show "session ended" state, navigate to `/note/:id` with `{ sessionComplete: true, sessionId }`
- Mid-stream failure: inline error with retry button (re-sends last user message, discards incomplete assistant turn)
- Token limit hit during stream: blocking error state, no further input

**Tests:** `SESSION_COMPLETE` detection triggers navigation with correct router state; mid-stream error shows retry; offline attempt shows toast; messages written to Firestore after each exchange.

---

## ~~Stage 9 — Dashboard & Library~~

### Dashboard
- Query due notes (`next_review_at <= today`, `deleted_at == null`), sorted most overdue first
- Query recent notes (last 5 by `created_at`, `deleted_at == null`)
- "Begin session" CTA: starts session for most overdue note (same logic as note detail)
- Stats from `meta/stats`: total notes; recall percent (`passing_sessions / total_sessions`) — hidden until `total_sessions >= 3`

### Library
- Load all non-deleted notes
- Client-side filter by tag (chip picker)
- Client-side search by title and tag
- Sort toggle: recent / strength / tag

**Tests:** due notes query filters correctly; recall percent hidden below 3 sessions; library search filters by title and tag; sort orders apply correctly.

---

## ~~Stage 10 — PWA~~

- Configure `vite-plugin-pwa`: app name, icons, theme color (`#0E0C09`), `display: standalone`
- Service worker: cache app shell (HTML, JS, CSS, fonts); Firestore and API calls always network-first
- Offline toast: if `navigator.onLine === false` and user taps "Begin session", show toast

**Tests:** service worker registers in production build; offline session attempt triggers toast.

---

## Token Tracker

Endpoint: `https://token-tracker-roan.vercel.app/api/tokens`  
See `INTEGRATION.md` for the full JS integration pattern. No TBD items remain — all stages can be built in sequence.
