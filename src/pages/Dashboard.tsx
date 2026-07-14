import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeToNotes } from '../lib/notes'
import { createSession, getIncompleteSession } from '../lib/sessions'
import { getStats } from '../lib/stats'
import { Rule } from '../components/Rule'
import { Tag } from '../components/Tag'
import { StrengthBar } from '../components/StrengthBar'
import type { Note, Stats } from '../types'
import type { Timestamp } from 'firebase/firestore'

function daysBetween(a: Date, b: Date): number {
  const da = new Date(a); da.setHours(0, 0, 0, 0)
  const db = new Date(b); db.setHours(0, 0, 0, 0)
  return Math.floor((da.getTime() - db.getTime()) / 86400000)
}

function overdueDays(ts: Timestamp): number {
  return Math.max(0, daysBetween(new Date(), ts.toDate()))
}

function ageLabel(ts: Timestamp): string {
  const days = daysBetween(new Date(), ts.toDate())
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

function reviewedLabel(ts: Timestamp | null): string {
  return ts ? `reviewed ${ageLabel(ts)}` : 'never reviewed'
}

function nextReviewLabel(ts: Timestamp): string {
  const days = daysBetween(ts.toDate(), new Date())
  if (days <= 0) return 'next today'
  if (days === 1) return 'next tomorrow'
  return `next +${days}d`
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatDate(d: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [starting, setStarting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [subscribeError, setSubscribeError] = useState<string | null>(null)

  useEffect(() => subscribeToNotes(setNotes, err => setSubscribeError(err.message)), [])
  useEffect(() => { getStats().then(setStats).catch(err => setSubscribeError(err instanceof Error ? err.message : String(err))) }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const dueNotes = useMemo(() => {
    const now = new Date()
    return notes
      .filter(n => n.next_review_at?.toDate() <= now)
      .sort((a, b) => a.next_review_at.toDate().getTime() - b.next_review_at.toDate().getTime())
  }, [notes])

  const recentNotes = useMemo(() =>
    [...notes]
      .filter(n => n.created_at != null)
      .sort((a, b) => b.created_at.toDate().getTime() - a.created_at.toDate().getTime())
      .slice(0, 5),
    [notes],
  )

  const recallPct = stats && stats.total_sessions >= 3
    ? Math.round((stats.passing_sessions / stats.total_sessions) * 100)
    : null

  async function beginSession(noteId: string) {
    if (starting) return
    if (!navigator.onLine) {
      setToast('No internet connection — start a session when you\'re back online.')
      return
    }
    setStarting(true)
    setSessionError(null)
    try {
      const existing = await getIncompleteSession(noteId)
      navigate(existing ? `/session/${existing.id}` : `/session/${await createSession(noteId)}`)
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : String(err))
    } finally {
      setStarting(false)
    }
  }

  const mostOverdue = dueNotes[0]
  const today = formatDate(new Date())

  return (
    <div className="pt-6 pb-24 md:pt-0 md:pb-0 md:h-full md:flex md:flex-col">

      {/* ── PAGE HEAD ──
          Mobile: flex-col → title stacks above button
          Desktop: flex-row items-end justify-between → title left, button right
      */}
      <div className="px-5 md:px-10 md:pt-8 md:pb-6 md:flex md:items-end md:justify-between">
        <div>
          <div className="hidden md:block font-mono text-[11px] uppercase tracking-[0.22em] text-dim">
            {today}
          </div>
          <h1 className="font-sans text-[26px] md:text-[28px] leading-[1.15] md:leading-none font-light tracking-tight md:mt-2">
            {dueNotes.length === 0
              ? 'Nothing due today.'
              : (
                <>
                  {dueNotes.length === 1 ? 'One note is' : `${dueNotes.length} notes are`}{' '}
                  <span style={{ color: 'var(--accent)' }}>due for review</span>.
                </>
              )}
          </h1>
          <p className="mt-2 md:hidden font-mono text-[13px] text-muted leading-relaxed">
            {dueNotes.length > 0 && 'Sit with them before they cool. A session takes about eight minutes.'}
          </p>
        </div>
        {/* Single Begin Session button — below title on mobile, right of title on desktop */}
        {mostOverdue && (
          <button
            onClick={() => beginSession(mostOverdue.id)}
            disabled={starting}
            className="mt-5 md:mt-0 inline-flex items-center gap-3 font-mono text-[13px] uppercase tracking-[0.14em] px-4 py-3 border border-accent text-ink bg-accent disabled:opacity-70"
          >
            <span>Begin session</span>
            <span className="opacity-70">→</span>
          </button>
        )}
      </div>

      <Rule />

      {(sessionError || subscribeError) && (
        <pre role="alert" className="px-5 md:px-10 py-3 font-mono text-[12px] text-accent whitespace-pre-wrap select-all border-b border-rule">
          {sessionError || subscribeError}
        </pre>
      )}

      {/* ── CONTENT: mobile = stacked cols, desktop = 2-column grid ── */}
      <div className="md:flex-1 md:grid md:grid-cols-[1.55fr_1fr] md:min-h-0">

        {/* LEFT: due notes */}
        <div className="md:border-r md:border-rule md:overflow-y-auto md:thinbar">
          {dueNotes.length > 0 && (
            <>
              <div className="mt-10 md:mt-0 px-5 md:px-10 pt-0 md:pt-6 pb-3 flex items-baseline justify-between">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                  Due · {pad2(dueNotes.length)}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
                  strength · age
                </div>
              </div>
              <Rule />
              <ul>
                {dueNotes.map((n, i) => {
                  const od = overdueDays(n.next_review_at)
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => navigate(`/note/${n.id}`)}
                        className="group w-full text-left px-5 md:px-10 py-4 md:py-6 hover:bg-ink-2 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4 md:gap-6">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <Tag>{n.tag}</Tag>
                              <span className="font-mono text-[11px] text-dim">·</span>
                              <span
                                className="font-mono text-[11px] uppercase tracking-wider"
                                style={{ color: od > 0 ? 'var(--accent)' : 'var(--muted)' }}
                              >
                                {od === 0 ? 'due today' : `${od}d overdue`}
                              </span>
                            </div>
                            <div className="mt-2 font-sans text-[15px] md:text-[18px] leading-snug">
                              {n.title}
                            </div>
                            <div className="mt-1 md:mt-2 font-mono text-[12px] md:text-[13px] text-muted truncate md:whitespace-normal md:max-w-[46ch] md:leading-relaxed">
                              {n.what_it_said}
                            </div>
                          </div>
                          <div className="shrink-0 pt-1 flex flex-col items-end gap-3">
                            {n.last_rating != null && (
                              <StrengthBar value={n.last_rating} showLabel={false} />
                            )}
                            <span className="hidden md:block font-mono text-[12px] text-dim opacity-0 group-hover:opacity-100 transition-opacity">
                              review →
                            </span>
                          </div>
                        </div>
                      </button>
                      {i < dueNotes.length - 1 && <Rule dashed />}
                    </li>
                  )
                })}
              </ul>
              <Rule />
            </>
          )}
        </div>

        {/* RIGHT: recent notes + stats */}
        <div className="md:overflow-y-auto md:thinbar">
          {recentNotes.length > 0 && (
            <>
              <div className="mt-10 md:mt-0 px-5 md:px-8 pt-0 md:pt-6 pb-3 flex items-baseline justify-between">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Recent</div>
                <button
                  onClick={() => navigate('/library')}
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim hover:text-muted"
                >
                  all →
                </button>
              </div>
              <Rule />
              <ul>
                {recentNotes.map((n, i) => (
                  <li key={n.id}>
                    <button
                      onClick={() => navigate(`/note/${n.id}`)}
                      className="w-full text-left px-5 md:px-8 py-3 md:py-4 hover:bg-ink-2 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-sans text-[14px] truncate">{n.title}</div>
                          <div className="mt-[2px] md:mt-1 flex items-center gap-3">
                            <Tag>{n.tag}</Tag>
                            <span className="font-mono text-[11px] text-dim">·</span>
                            <span className="font-mono text-[11px] text-dim">
                              added {ageLabel(n.created_at)}
                            </span>
                            <span className="font-mono text-[11px] text-dim">·</span>
                            <span className="font-mono text-[11px] text-dim">
                              {reviewedLabel(n.last_reviewed_at)}
                            </span>
                            <span className="font-mono text-[11px] text-dim">·</span>
                            <span className="font-mono text-[11px] text-dim">
                              {nextReviewLabel(n.next_review_at)}
                            </span>
                          </div>
                        </div>
                        {n.last_rating != null && (
                          <StrengthBar value={n.last_rating} showLabel={false} />
                        )}
                      </div>
                    </button>
                    {i < recentNotes.length - 1 && <Rule dashed />}
                  </li>
                ))}
              </ul>
              <Rule />
            </>
          )}

          {/* stats */}
          <div className="mt-8 md:mt-0 px-5 md:px-8 py-0 md:py-7">
            <div className="hidden md:block font-mono text-[11px] uppercase tracking-[0.18em] text-muted mb-4">
              Totals
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">notes</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-[22px] md:text-[26px] font-light">
                    {stats?.total_notes ?? '—'}
                  </span>
                  <span className="font-mono text-[11px] text-muted">total</span>
                </div>
              </div>
              {recallPct !== null && (
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">recall</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="font-mono text-[22px] md:text-[26px] font-light">{recallPct}</span>
                    <span className="font-mono text-[11px] text-muted">percent</span>
                  </div>
                </div>
              )}
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">sessions</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-[22px] md:text-[26px] font-light">
                    {stats?.total_sessions ?? '—'}
                  </span>
                  <span className="font-mono text-[11px] text-muted">total</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* offline toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-ink-2 border border-rule px-4 py-3 font-mono text-[13px] text-muted max-w-[320px] text-center"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
