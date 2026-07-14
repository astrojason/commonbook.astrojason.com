import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { Timestamp } from 'firebase/firestore'
import { getNoteById, softDeleteNote, updateNoteAfterRating } from '../lib/notes'
import { createSession, getCompletedSessions, getIncompleteSession, updateSession } from '../lib/sessions'
import { incrementStats } from '../lib/stats'
import { computeSM2 } from '../lib/sm2'
import { Rule } from '../components/Rule'
import { StrengthBar } from '../components/StrengthBar'
import { MarkdownBody } from '../components/MarkdownBody'
import type { Note, Session } from '../types'

const TIERS = ['cold', 'cool', 'warm', 'hot', 'solid'] as const
const NEXT_REVIEW_LABELS = ['tomorrow', '+2d', '+5d', '+14d', '+30d']
const INTERVAL_LABELS = ['+1d', '+2d', '+5d', '+14d', '+30d']

function formatCaptured(ts: Timestamp): string {
  const d = ts.toDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} · ${h}:${min}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatNextReview(ts: Timestamp): string {
  const d = ts.toDate()
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function isDue(ts: Timestamp): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return ts.toDate() <= today
}

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const sessionComplete = location.state?.sessionComplete === true
  const sessionId = location.state?.sessionId as string | undefined
  const suggestedRating = location.state?.suggestedRating as number | undefined

  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [rating, setRating] = useState<number | null>(suggestedRating ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [startingSession, setStartingSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedSessions, setCompletedSessions] = useState<Session[]>([])
  const [openSessionId, setOpenSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getNoteById(id)
      .then(n => { setNote(n); setLoading(false) })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    if (!id) return
    getCompletedSessions(id)
      .then(setCompletedSessions)
      .catch(() => { /* sessions list is best-effort */ })
  }, [id])

  function makeTimeout(ms = 12_000) {
    return new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out — Firestore did not respond. Reload and try again.')), ms)
    )
  }

  async function handleDelete() {
    if (!id) return
    try {
      await Promise.race([softDeleteNote(id), makeTimeout()])
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleStartSession() {
    if (!id) return
    setStartingSession(true)
    setError(null)
    try {
      const existing = await Promise.race([getIncompleteSession(id), makeTimeout()])
      if (existing) {
        navigate(`/session/${existing.id}`)
      } else {
        const newId = await Promise.race([createSession(id), makeTimeout()])
        navigate(`/session/${newId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setStartingSession(false)
    }
  }

  async function handleRatingSubmit() {
    if (!note || rating === null || !id) return
    setSubmitting(true)
    setError(null)
    try {
      const sm2 = computeSM2({
        rating,
        intervalDays: note.interval_days,
        easinessFactor: note.easiness_factor,
        sessionCount: note.session_count,
      })
      await Promise.race([updateNoteAfterRating(id, sm2, rating), makeTimeout()])
      if (sessionId) {
        await Promise.race([updateSession(sessionId, { self_rating: rating }), makeTimeout()])
      }
      incrementStats({
        total_sessions: 1,
        ...(rating >= 3 ? { passing_sessions: 1 } : {}),
      }).catch(err => console.error('Stats increment failed:', err))
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null
  if (error && !note) {
    return (
      <pre role="alert" className="px-5 pt-8 font-mono text-[12px] text-accent whitespace-pre-wrap select-all">
        {error}
      </pre>
    )
  }
  if (!note) {
    return <div className="px-5 pt-8 font-mono text-dim">Note not found.</div>
  }

  const due = isDue(note.next_review_at)

  return (
    <div className="pt-6 pb-32 md:pt-0 md:pb-0 md:h-full md:flex md:flex-col">

      {/* breadcrumb + title */}
      <div className="px-5 md:px-10 md:pt-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
        <button onClick={() => navigate(-1)} className="hover:text-muted">← back</button>
        <span>·</span>
        <span>{note.tag}</span>
      </div>

      <div className="px-5 md:px-10 mt-5 md:mt-3 md:pb-5">
        <h1 className="font-sans text-[22px] md:text-[26px] leading-snug md:leading-tight font-light md:max-w-[28ch]">
          {note.title}
        </h1>
      </div>

      <div className="mt-6 md:mt-0"><Rule /></div>

      {/*
        Layout: stacked on mobile, 2-column grid on desktop.
        Left col: reading body (mobile metadata shown at top, mobile only).
        Right col: desktop metadata + single rating section.
          On mobile: right col appears below left col (natural grid flow).
          On desktop: right col is beside left col.
      */}
      <div className="md:flex-1 md:grid md:grid-cols-[1fr_320px] md:min-h-0">

        {/* LEFT: reading column */}
        <div className="md:overflow-y-auto md:thinbar md:border-r md:border-rule">
          <div className="md:max-w-[680px] md:py-2">

            {/* mobile-only: metadata above body */}
            <div className="md:hidden px-5 pb-5">
              <div className="grid grid-cols-2 gap-y-2 gap-x-6">
                {[
                  ['Captured', formatCaptured(note.created_at)],
                  ['Reviews', `${note.session_count} · next ${formatNextReview(note.next_review_at)}`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">{k}</div>
                    <div className="font-mono text-[13px] text-muted mt-1">{v}</div>
                  </div>
                ))}
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">Strength</div>
                  <div className="mt-1">
                    {note.last_rating != null
                      ? <StrengthBar value={note.last_rating} />
                      : <span className="font-mono text-[13px] text-dim">—</span>}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">Status</div>
                  <div className="font-mono text-[13px] mt-1" style={{ color: due ? 'var(--accent)' : 'var(--muted)' }}>
                    {due ? 'due today' : 'upcoming'}
                  </div>
                </div>
              </div>
              <div className="mt-5"><Rule /></div>
            </div>

            {/* body sections */}
            {([
              { n: '01', label: 'What', body: note.what_it_said },
              { n: '02', label: 'Why',  body: note.why_it_matters },
              { n: '03', label: 'How',  body: note.application },
            ] as const).map((s, i) => (
              <div key={s.n}>
                <div className="px-5 md:px-10 py-5 md:py-7">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] md:text-[12px] text-dim">{s.n}</span>
                    <span className="font-mono text-[12px] md:text-[13px] uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-3 md:mt-4">
                    <MarkdownBody>{s.body}</MarkdownBody>
                  </div>
                </div>
                {i < 2 && <Rule dashed />}
              </div>
            ))}

            <Rule />

            {note.source_url && (
              <>
                <div className="px-5 md:px-10 py-5">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Source</div>
                  <a
                    href={note.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block font-mono text-[13px] underline decoration-dotted underline-offset-4 text-muted"
                    style={{ textDecorationColor: 'var(--rule-2)' }}
                  >
                    {note.source_url}
                  </a>
                </div>
                <Rule />
              </>
            )}

            {error && (
              <pre role="alert" className="px-5 md:px-10 pt-4 font-mono text-[12px] text-accent whitespace-pre-wrap select-all">
                {error}
              </pre>
            )}

            {/* actions */}
            <div className="px-5 md:px-10 py-5 flex items-center gap-3">
              <button
                onClick={handleStartSession}
                disabled={startingSession}
                className="flex-1 md:flex-none font-mono text-[12px] uppercase tracking-[0.14em] px-3 py-3 border border-accent text-accent hover:bg-ink-2 disabled:opacity-50"
              >
                {startingSession ? 'opening…' : '→ start session'}
              </button>
              <button
                onClick={() => navigate(`/capture?edit=${id}`)}
                className="font-mono text-[12px] uppercase tracking-[0.14em] px-3 py-3 border border-rule text-muted hover:border-rule-2"
              >
                edit
              </button>
              {confirmingDelete ? (
                <>
                  <button
                    onClick={handleDelete}
                    className="font-mono text-[12px] uppercase tracking-[0.14em] px-3 py-3 border border-accent text-accent"
                  >
                    confirm
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="font-mono text-[12px] uppercase tracking-[0.14em] px-2 py-3 text-dim"
                  >
                    cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="font-mono text-[12px] uppercase tracking-[0.14em] px-3 py-3 border border-rule text-dim hover:border-rule-2"
                >
                  delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/*
          RIGHT: meta + rating.
          On mobile: appears below reading column as block element.
          On desktop: appears in right grid column.
        */}
        <div className="md:flex md:flex-col md:overflow-y-auto md:thinbar">

          {/* desktop-only metadata */}
          <div className="hidden md:block px-7 py-6">
            <div className="space-y-5">
              {[
                ['Captured', formatCaptured(note.created_at)],
                ['Reviews', `${note.session_count} · next ${formatNextReview(note.next_review_at)}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">{k}</div>
                  <div className="font-mono text-[13px] text-muted mt-1">{v}</div>
                </div>
              ))}
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">Strength</div>
                <div className="mt-2">
                  {note.last_rating != null
                    ? <StrengthBar value={note.last_rating} />
                    : <span className="font-mono text-[13px] text-dim">—</span>}
                </div>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">Status</div>
                <div className="font-mono text-[13px] mt-1" style={{ color: due ? 'var(--accent)' : 'var(--muted)' }}>
                  {due ? 'due today' : 'upcoming'}
                </div>
              </div>
            </div>
          </div>
          <div className="hidden md:block"><Rule /></div>

          {/* Past sessions */}
          {completedSessions.length > 0 && (
            <div data-testid="past-sessions">
              {completedSessions.map(sess => {
                const isOpen = openSessionId === sess.id
                const tier = sess.self_rating != null ? ['cold','cool','warm','hot','solid'][sess.self_rating - 1] : null
                return (
                  <div key={sess.id} className="border-b border-rule">
                    <button
                      onClick={() => setOpenSessionId(isOpen ? null : sess.id)}
                      className="w-full px-5 md:px-7 py-3 flex items-center justify-between"
                      data-testid={`session-toggle-${sess.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                          {formatCaptured(sess.completed_at!)}
                        </span>
                        {tier && (
                          <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--accent)' }}>
                            {tier}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-dim">{isOpen ? '▲' : '▼'}</span>
                    </button>
                    {isOpen && (
                      <div className="px-5 md:px-7 pb-5 space-y-4 font-mono text-[13px] leading-relaxed max-h-[340px] overflow-y-auto thinbar" data-testid={`session-transcript-${sess.id}`}>
                        {sess.messages.map((m, i) => (
                          <div key={i}>
                            <div
                              className="text-[11px] uppercase tracking-[0.18em] mb-[2px]"
                              style={{ color: m.role === 'user' ? 'var(--accent)' : 'var(--muted)' }}
                            >
                              {m.role === 'user' ? '> me' : 'recall'}
                            </div>
                            <div style={{ color: 'var(--text)' }}>{m.content}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Rating — single DOM node, responsive styling for both mobile and desktop */}
          <div className="px-5 md:px-7 py-6 bg-ink-2 md:flex-1">
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                How well do you remember?
              </div>
              <div className="font-mono text-[11px] text-dim">1—5</div>
            </div>
            <div className="mt-1 font-mono text-[12px] text-dim leading-relaxed">
              Be honest. The schedule depends on it.
            </div>
            {suggestedRating != null && (
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-dim" data-testid="ai-suggested-label">
                AI suggested · change if you disagree
              </div>
            )}

            {!sessionComplete && (
              <div className="mt-4 font-mono text-[12px] text-dim" data-testid="rating-locked">
                Complete a session to unlock self-rating.
              </div>
            )}

            {sessionComplete && (
              <div data-testid="rating-unlocked">
                {/*
                  Mobile: grid-cols-5 with top border.
                  Desktop: flex-col with left border, interval label.
                  Single DOM, responsive CSS.
                */}
                <div className="mt-5 grid grid-cols-5 gap-[2px] md:flex md:flex-col">
                  {TIERS.map((label, i) => {
                    const v = i + 1
                    const active = rating === v
                    return (
                      <button
                        key={label}
                        onClick={() => setRating(v)}
                        aria-label={label}
                        className="border-t-2 md:border-t-0 md:border-l-2 text-left px-2 md:px-4 py-4 md:py-3 md:flex md:items-center md:justify-between"
                        style={{
                          borderColor: active ? 'var(--accent)' : 'var(--rule-2)',
                          background: active ? 'var(--ink-3)' : 'transparent',
                        }}
                      >
                        <div className="md:flex md:items-center md:gap-3">
                          <div className="font-mono text-[11px] text-dim">{v}</div>
                          <div
                            className="font-mono text-[12px] md:text-[13px] uppercase tracking-wider mt-1 md:mt-0"
                            style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
                          >
                            {label}
                          </div>
                        </div>
                        <span className="hidden md:inline font-mono text-[11px] text-dim">
                          {INTERVAL_LABELS[i]}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="font-mono text-[12px] text-muted">
                    {rating != null
                      ? (
                        <>
                          Next review:{' '}
                          <span style={{ color: 'var(--accent)' }}>
                            {NEXT_REVIEW_LABELS[rating - 1]}
                          </span>
                        </>
                      )
                      : <span className="text-dim">— select a tier to schedule</span>}
                  </div>
                  <button
                    disabled={rating === null || submitting}
                    onClick={handleRatingSubmit}
                    className="font-mono text-[12px] uppercase tracking-[0.14em] px-3 py-2 border disabled:border-rule disabled:text-dim"
                    style={{ borderColor: rating != null ? 'var(--accent)' : undefined, color: rating != null ? 'var(--accent)' : undefined }}
                  >
                    {submitting ? 'saving…' : 'Log review →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
