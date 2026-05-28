import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { Timestamp } from 'firebase/firestore'
import { getNoteById, softDeleteNote, updateNoteAfterRating } from '../lib/notes'
import { createSession, getIncompleteSession, updateSession } from '../lib/sessions'
import { incrementStats } from '../lib/stats'
import { computeSM2 } from '../lib/sm2'
import { Rule } from '../components/Rule'
import { StrengthBar } from '../components/StrengthBar'
import type { Note } from '../types'

const TIERS = ['cold', 'cool', 'warm', 'hot', 'solid'] as const
const NEXT_REVIEW_LABELS = ['tomorrow', '+2d', '+5d', '+14d', '+30d']

function formatCaptured(ts: Timestamp): string {
  const d = ts.toDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} · ${h}:${min}`
}

function formatNextReview(ts: Timestamp): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(ts.toDate())
  target.setHours(0, 0, 0, 0)

  if (target <= today) return 'today'

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (target.getTime() === tomorrow.getTime()) return 'tomorrow'

  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return `+${diff}d`
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

  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [startingSession, setStartingSession] = useState(false)

  useEffect(() => {
    if (!id) return
    getNoteById(id).then(n => {
      setNote(n)
      setLoading(false)
    })
  }, [id])

  async function handleDelete() {
    if (!id) return
    await softDeleteNote(id)
    navigate('/')
  }

  async function handleStartSession() {
    if (!id) return
    setStartingSession(true)
    try {
      const existing = await getIncompleteSession(id)
      if (existing) {
        navigate(`/session/${existing.id}`)
      } else {
        const newId = await createSession(id)
        navigate(`/session/${newId}`)
      }
    } finally {
      setStartingSession(false)
    }
  }

  async function handleRatingSubmit() {
    if (!note || rating === null || !id) return
    setSubmitting(true)
    try {
      const sm2 = computeSM2({
        rating,
        intervalDays: note.interval_days,
        easinessFactor: note.easiness_factor,
        sessionCount: note.session_count,
      })
      await updateNoteAfterRating(id, sm2, rating)
      if (sessionId) {
        await updateSession(sessionId, { self_rating: rating })
      }
      await incrementStats({
        total_sessions: 1,
        ...(rating >= 3 ? { passing_sessions: 1 } : {}),
      })
      navigate('/')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null
  if (!note) {
    return <div className="px-5 pt-8 font-mono text-dim">Note not found.</div>
  }

  const due = isDue(note.next_review_at)

  return (
    <div className="pt-6 pb-32">
      {/* breadcrumb */}
      <div className="px-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
        <button onClick={() => navigate(-1)} className="hover:text-muted">← back</button>
        <span>·</span>
        <span>{note.tag}</span>
      </div>

      {/* title + metadata */}
      <div className="px-5 mt-5">
        <h1 className="font-sans text-[22px] leading-snug font-light">{note.title}</h1>
        <div className="mt-4 grid grid-cols-2 gap-y-2 gap-x-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">Captured</div>
            <div className="font-mono text-[12px] text-muted mt-1">{formatCaptured(note.created_at)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">Reviews</div>
            <div className="font-mono text-[12px] text-muted mt-1">
              {note.session_count} · next {formatNextReview(note.next_review_at)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">Strength</div>
            <div className="mt-1">
              {note.last_rating != null
                ? <StrengthBar value={note.last_rating} />
                : <span className="font-mono text-[12px] text-dim">—</span>}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">Status</div>
            <div
              className="font-mono text-[12px] mt-1"
              style={{ color: due ? 'var(--accent)' : 'var(--muted)' }}
            >
              {due ? 'due today' : 'upcoming'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6"><Rule /></div>

      {/* body sections */}
      {([
        { n: '01', label: 'What', body: note.what_it_said },
        { n: '02', label: 'Why',  body: note.why_it_matters },
        { n: '03', label: 'How',  body: note.application },
      ] as const).map((s, i) => (
        <div key={s.n}>
          <div className="px-5 py-5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] text-dim">{s.n}</span>
              <span
                className="font-mono text-[11px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--accent)' }}
              >
                {s.label}
              </span>
            </div>
            <p className="mt-3 font-mono text-[14px] leading-[1.7] text-[color:var(--text)]">{s.body}</p>
          </div>
          {i < 2 && <Rule dashed />}
        </div>
      ))}

      <Rule />

      {/* source URL */}
      {note.source_url && (
        <>
          <div className="px-5 py-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Source</div>
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

      {/* actions */}
      <div className="px-5 py-5 flex items-center gap-3">
        <button
          onClick={handleStartSession}
          disabled={startingSession}
          className="flex-1 font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-3 border border-accent text-accent hover:bg-ink-2 disabled:opacity-50"
        >
          {startingSession ? 'opening…' : '→ start session'}
        </button>
        <button
          onClick={() => navigate(`/capture?edit=${id}`)}
          className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-3 border border-rule text-muted hover:border-rule-2"
        >
          edit
        </button>
        {confirmingDelete ? (
          <>
            <button
              onClick={handleDelete}
              className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-3 border border-accent text-accent"
            >
              confirm
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="font-mono text-[11px] uppercase tracking-[0.14em] px-2 py-3 text-dim"
            >
              cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-3 border border-rule text-dim hover:border-rule-2"
          >
            delete
          </button>
        )}
      </div>

      <Rule />

      {/* self-rating */}
      <div className="px-5 py-6 bg-ink-2">
        <div className="flex items-baseline justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            How well do you remember?
          </div>
          <div className="font-mono text-[10px] text-dim">1—5</div>
        </div>
        <div className="mt-1 font-mono text-[11px] text-dim leading-relaxed">
          Be honest. The schedule depends on it.
        </div>

        {!sessionComplete && (
          <div className="mt-4 font-mono text-[11px] text-dim" data-testid="rating-locked">
            Complete a session to unlock self-rating.
          </div>
        )}

        {sessionComplete && (
          <div data-testid="rating-unlocked">
            <div className="mt-5 grid grid-cols-5 gap-[2px]">
              {TIERS.map((label, i) => {
                const v = i + 1
                const active = rating === v
                return (
                  <button
                    key={label}
                    onClick={() => setRating(v)}
                    aria-label={label}
                    className="py-4 border-t-2 text-left px-2"
                    style={{
                      borderColor: active ? 'var(--accent)' : 'var(--rule-2)',
                      background: active ? 'var(--ink-3)' : 'transparent',
                    }}
                  >
                    <div className="font-mono text-[10px] text-dim">{v}</div>
                    <div
                      className="font-mono text-[11px] uppercase tracking-wider mt-1"
                      style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
                    >
                      {label}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="font-mono text-[11px] text-muted">
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
                className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 border disabled:border-rule disabled:text-dim"
                style={{ borderColor: rating != null ? 'var(--accent)' : undefined, color: rating != null ? 'var(--accent)' : undefined }}
              >
                {submitting ? 'saving…' : 'Log review →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
