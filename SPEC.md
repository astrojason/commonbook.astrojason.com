# commonbook — Personal Knowledge Retention App
## Spec for Claude Code

---

## Overview

A personal PWA for capturing things worth remembering, reinforcing them with AI-driven quiz sessions, and surfacing them for review on a spaced repetition schedule. No multi-user support. Deployed to Vercel. Free to run (Firestore free tier + OpenAI API pay-as-you-go).

---

## Tech Stack

- **Frontend:** React (Vite), PWA (vite-plugin-pwa)
- **Backend/DB:** Firebase Firestore
- **AI:** OpenAI API (`gpt-4o-mini`) — proxied through a Vercel serverless function; API key is server-side only, never in the client bundle
- **Deployment:** Vercel
- **Auth:** Firebase Auth — Google sign-in (single user, just to protect the deployment)

---

## Data Model (Firestore)

### `notes/{noteId}`
```
title             string
tag               string           // free-form topic tag (e.g. "probability", "design")
source_url        string | null
what_it_said      string           // prompt 1
why_it_matters    string           // prompt 2
application       string           // prompt 3: plain-language explanation / analogy
created_at        timestamp
next_review_at    timestamp
interval_days     number           // current interval (days)
easiness_factor   number           // SM-2 EF, default 2.5
session_count     number           // total sessions completed
last_rating       number | null    // most recent self_rating, used for strength display
deleted_at        timestamp | null // soft delete; filter out wherever notes are queried
```

### `sessions/{sessionId}`
```
note_id           string
messages          array of { role: "user"|"assistant", content: string }
completed_at      timestamp | null
self_rating       number | null    // 1–5, set on completion
```

### `meta/stats`
```
total_sessions    number   // incremented on each session completion
passing_sessions  number   // incremented when self_rating >= 3
total_notes       number   // incremented on capture, decremented on soft delete
```
Updated by the client at the same time as the note/session writes.

Sessions are tied to a concept (one per note), not to a date. A note can have many sessions over its lifetime.

Strength display (`StrengthBar`) maps to `last_rating` on the note (1–5). Notes with no completed sessions show no bar.

---

## Spaced Repetition Logic (SM-2)

Triggered on session completion when the user submits a self-rating (1–5). Rating without a completed session is not allowed.

```
if rating < 3:
  interval_days = 1
  easiness_factor = max(1.3, EF - 0.2)
else:
  if session_count == 0: interval = 1
  if session_count == 1: interval = 6
  else: interval = round(interval_days * easiness_factor)
  easiness_factor = EF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  easiness_factor = max(1.3, easiness_factor)

next_review_at = now + interval_days
session_count++
```

---

## AI Session Behavior

### Vercel API Route (`/api/chat`)

The client posts the message history + note context to a Vercel serverless function. The function builds the system prompt from the note fields, calls OpenAI with `stream: true` and `stream_options: { include_usage: true }`, and pipes the full SSE stream (including the final usage chunk) back to the client. The client reads the usage chunk to POST token counts to the token limit endpoint. The `OPENAI_API_KEY` env var is server-side only.

Request body:
```json
{
  "sessionId": "...",
  "noteContext": {
    "what_it_said": "...",
    "why_it_matters": "...",
    "application": "..."
  },
  "messages": [{ "role": "user"|"assistant", "content": "..." }]
}
```

### System Prompt (injected server-side, never sent to client)
```
You are a recall coach. Your job is to test understanding, not validate it.

The user has captured a note:
- What it said: {what_it_said}
- Why it matters: {why_it_matters}
- Explanation: {application}

Rules:
1. Ask 3–5 questions that test real understanding — not surface recall. Use: explain in their own words, apply to a hypothetical, identify edge cases, find the flaw in the reasoning, connect to something else.
2. After each answer, give short honest feedback. If the answer is incomplete or vague, say so directly. Do not say "great answer," "exactly right," or any variation. If the answer is correct, move on. If it's wrong or shallow, push back.
3. Do not help them remember. Do not restate or hint at the note content. If they don't know, that's the point.
4. When all questions are done, output the exact string "SESSION_COMPLETE" on its own line, then stop.
```

### Session UI
- Chat interface with streaming responses
- After each complete exchange (user turn + full assistant response received), client writes the updated `messages` array to `sessions/{sessionId}` in Firestore — enables seamless resume of incomplete sessions
- Client also writes each new message to the session doc; the Vercel function is stateless (OpenAI proxy only)
- **Token limit:** `https://token-tracker-roan.vercel.app/api/tokens`
  - `GET /api/tokens` → `{ tokens: number, date: string }` — current daily usage
  - `POST /api/tokens` with `{ tokens: number }` — add to daily total; called after each exchange with `input_tokens + output_tokens` from the OpenAI stream usage chunk
  - Daily limit: 250k tokens (resets 00:00 UTC). Before starting a session, GET current usage:
    - **Under 250k:** proceed silently — no prompt, no friction
    - **At or over 250k:** show a confirmation prompt (soft gate, not a hard block) — "You've used Xk tokens today. Continue anyway?" User can confirm and proceed, or cancel
  - Endpoint unreachable: fail open — proceed silently, same as "under limit"
- When response contains `SESSION_COMPLETE`: hide input, show a "session complete" state, then navigate back to note detail with router state `{ sessionComplete: true, sessionId }`
- **On mid-stream failure:** show an inline error in the chat with a retry button; re-send the last user message. The incomplete assistant turn is discarded; the persisted messages array (already written after the user's turn) is preserved.
- If the user attempts to start a session while offline: show a toast — no offline session support

---

## Screens

### 0. Sign-in (`/login`)
- Shown to unauthenticated users; all other routes redirect here
- Single "Sign in with Google" button
- On success: redirect to `/`

### 1. Dashboard (`/`)
- **Due for review** — notes where `next_review_at <= today`, sorted by most overdue
- **Recent notes** — last 5 captured, with session count and next review date
- **"Begin session" CTA** — starts a session for the most overdue note automatically; individual due note rows are also tappable to start that specific note's session
- **Stats:** total notes; recall percent (% of completed sessions with `self_rating >= 3`) — only shown once there are at least 3 completed sessions; read from `meta/stats` doc (see Data Model)

### 2. Capture (`/capture`)
Prompted form:
- Title (required text input — rendered above the numbered fields, not part of the 01/02/03 structure)
- Tag (free-form text; chip suggestions derived from existing notes at load time; user can type a new tag)
- Source URL (optional)
- 01 — What did it say? (textarea)
- 02 — Why does it matter? (textarea)
- 03 — How would you explain it? (textarea — plain-language analogy, not a system or action plan)

On save: write to Firestore, set `next_review_at = now + 1 day`, `interval_days = 1`, `easiness_factor = 2.5`, `session_count = 0`

### 3. Note Detail (`/note/:id`)
- Displays all note fields
- Metadata grid: captured date / review count + next review / strength / status
- Edit button — opens the capture form pre-filled; saving updates the note without resetting SM-2 state
- Delete button — sets `deleted_at` on the note (soft delete); note disappears from all queries immediately
- "Start Session" button:
  - If an incomplete session exists for this note (`completed_at: null`), resume it — navigate to `/session/:existingSessionId`
  - Otherwise create a new session doc and navigate to `/session/:newSessionId`
- Self-rating UI — only active when navigated back from a completed session (passed via router state); otherwise locked
  - Ratings: 1 cold / 2 cool / 3 warm / 4 hot / 5 solid
  - Shows projected next review date based on selected rating before confirming
  - On submit: run SM-2, write updated fields to `notes/{noteId}`, write `self_rating` + `completed_at` to the session doc

### 4. Session (`/session/:sessionId`)
- Chat UI with streaming responses via `/api/chat`
- When `SESSION_COMPLETE` sentinel is detected: hide input, show "session ended" state
- On complete: navigate back to note detail (where self-rating becomes active)

### 5. Library (`/library`)
- All notes, sorted by `next_review_at` ascending
- Filter by tag
- Search by title and tag (client-side filter on loaded result set)

---

## Design Direction

Dark theme. Utilitarian but not ugly — think a well-designed notebook or field manual. No gradients, no purple. Typography-forward. Monospaced or slab serif for note content to feel intentional and permanent. Keep it fast and low-distraction — this is a tool, not a product.

---

## Environment Variables

### Server-side (Vercel, not exposed to client)
```
OPENAI_API_KEY
```

### Client-side (Vite, `VITE_` prefix, safe to expose)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
```

---

## Out of Scope (v1)

- Push notifications
- Mobile app (PWA on mobile browser is sufficient)
- Import/export
- Sharing
- N-back or other cognitive exercises
