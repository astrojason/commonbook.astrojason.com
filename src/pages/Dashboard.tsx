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

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [starting, setStarting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => subscribeToNotes(setNotes), [])
  useEffect(() => { getStats().then(setStats) }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const dueNotes = useMemo(() => {
    const now = new Date()
    return notes
      .filter(n => n.next_review_at.toDate() <= now)
      .sort((a, b) => a.next_review_at.toDate().getTime() - b.next_review_at.toDate().getTime())
  }, [notes])

  const recentNotes = useMemo(() =>
    [...notes]
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
    try {
      const existing = await getIncompleteSession(noteId)
      navigate(existing ? `/session/${existing.id}` : `/session/${await createSession(noteId)}`)
    } finally {
      setStarting(false)
    }
  }

  const mostOverdue = dueNotes[0]

  return (
    <div className="pt-6 pb-24">
      {/* heading */}
      <div className="px-5">
        <h1 className="font-sans text-[26px] leading-[1.15] font-light tracking-tight">
          {dueNotes.length === 0
            ? 'Nothing due today.'
            : (
              <>
                {dueNotes.length === 1 ? 'One note is' : `${dueNotes.length} notes are`}{' '}
                <span style={{ color: 'var(--accent)' }}>due for review</span>.
              </>
            )}
        </h1>
        {dueNotes.length > 0 && (
          <p className="mt-2 font-mono text-[12px] text-muted leading-relaxed">
            Sit with them before they cool. A session takes about eight minutes.
          </p>
        )}

        {mostOverdue && (
          <button
            onClick={() => beginSession(mostOverdue.id)}
            disabled={starting}
            className="mt-5 inline-flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.14em] px-4 py-3 border border-accent text-ink bg-accent disabled:opacity-70"
          >
            <span>Begin session</span>
            <span className="opacity-70">→</span>
          </button>
        )}
      </div>

      {/* due notes */}
      {dueNotes.length > 0 && (
        <>
          <div className="mt-10 px-5 flex items-baseline justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Due · {pad2(dueNotes.length)}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
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
                    className="w-full text-left px-5 py-4 hover:bg-ink-2"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-sans text-[15px] leading-snug">{n.title}</div>
                        <div className="mt-1 font-mono text-[11px] text-muted truncate">
                          {n.what_it_said}
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <Tag>{n.tag}</Tag>
                          <span className="font-mono text-[10px] text-dim">·</span>
                          <span
                            className="font-mono text-[10px] uppercase tracking-wider"
                            style={{ color: od > 0 ? 'var(--accent)' : 'var(--muted)' }}
                          >
                            {od === 0 ? 'due today' : `${od}d overdue`}
                          </span>
                        </div>
                      </div>
                      {n.last_rating != null && (
                        <div className="shrink-0 pt-1">
                          <StrengthBar value={n.last_rating} showLabel={false} />
                        </div>
                      )}
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

      {/* recent notes */}
      {recentNotes.length > 0 && (
        <>
          <div className="mt-10 px-5 flex items-baseline justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Recent</div>
            <button
              onClick={() => navigate('/library')}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim hover:text-muted"
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
                  className="w-full text-left px-5 py-3 hover:bg-ink-2"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-sans text-[14px] truncate text-[color:var(--text)]">
                        {n.title}
                      </div>
                      <div className="mt-[2px] flex items-center gap-3">
                        <Tag>{n.tag}</Tag>
                        <span className="font-mono text-[10px] text-dim">·</span>
                        <span className="font-mono text-[10px] text-dim">
                          {ageLabel(n.created_at)}
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
      <div className="mt-8 px-5 grid grid-cols-2 gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">notes</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-[22px] text-[color:var(--text)] font-light">
              {stats?.total_notes ?? '—'}
            </span>
            <span className="font-mono text-[10px] text-muted">total</span>
          </div>
        </div>
        {recallPct !== null && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">recall</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-[22px] text-[color:var(--text)] font-light">
                {recallPct}
              </span>
              <span className="font-mono text-[10px] text-muted">percent</span>
            </div>
          </div>
        )}
      </div>

      {/* offline toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-ink-2 border border-rule px-4 py-3 font-mono text-[12px] text-muted max-w-[320px] text-center"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
