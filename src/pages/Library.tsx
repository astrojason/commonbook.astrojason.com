import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeToNotes } from '../lib/notes'
import { Rule } from '../components/Rule'
import { Tag } from '../components/Tag'
import { Chip } from '../components/Chip'
import { StrengthBar } from '../components/StrengthBar'
import type { Note } from '../types'
import type { Timestamp } from 'firebase/firestore'

type SortKey = 'recent' | 'strength' | 'tag'

function sortNotes(notes: Note[], sort: SortKey): Note[] {
  const list = [...notes]
  if (sort === 'recent') {
    list.sort((a, b) => b.created_at.toDate().getTime() - a.created_at.toDate().getTime())
  } else if (sort === 'strength') {
    list.sort((a, b) => (b.last_rating ?? -1) - (a.last_rating ?? -1))
  } else {
    list.sort((a, b) => a.tag.localeCompare(b.tag) || a.title.localeCompare(b.title))
  }
  return list
}

function ageLabel(ts: Timestamp): string {
  const now = new Date()
  const then = ts.toDate()
  const days = Math.floor((now.getTime() - then.getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1d'
  if (days < 7) return `${days}d`
  if (days < 14) return '1w'
  if (days < 21) return '2w'
  if (days < 28) return '3w'
  return `${Math.floor(days / 7)}w`
}

function reviewedLabel(ts: Timestamp | null): string {
  return ts ? ageLabel(ts) : 'never'
}

export default function Library() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[]>([])
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeToNotes(setNotes, err => setError(err.message)), [])

  const tags = useMemo(() => {
    const set = new Set(notes.map(n => n.tag))
    return ['all', ...Array.from(set).sort()]
  }, [notes])

  const filtered = useMemo(() => {
    let list = activeTag === 'all' ? notes : notes.filter(n => n.tag === activeTag)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) || n.tag.toLowerCase().includes(q),
      )
    }
    return sortNotes(list, sort)
  }, [notes, activeTag, query, sort])

  return (
    <div className="pt-6 pb-24 md:pt-0 md:pb-0 md:h-full md:flex md:flex-col">

      {/* ── PAGE HEAD ── */}
      <div className="px-5 md:px-10 md:pt-8 md:pb-6 md:flex md:items-end md:justify-between">
        <div>
          <div className="hidden md:block font-mono text-[11px] uppercase tracking-[0.22em] text-dim">Archive</div>
          <h1 className="font-sans text-[24px] md:text-[28px] font-light tracking-tight md:mt-2 md:leading-none">
            Library
          </h1>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          {filtered.length} / {notes.length}
        </div>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="px-5 md:px-10 mt-5 md:mt-0 md:pb-5">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-3 border-b border-rule pb-2 flex-1 md:max-w-[420px]">
            <span className="font-mono text-[13px]" style={{ color: 'var(--accent)' }}>/</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="search title or tag…"
              aria-label="search"
              className="flex-1 bg-transparent border-0 outline-none font-mono text-[13px] caret-accent"
              style={{ color: 'var(--text)' }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="font-mono text-[11px] text-dim hover:text-muted"
              >
                clr
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.18em]">
            <span className="text-dim">sort</span>
            {(['recent', 'strength', 'tag'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{ color: sort === s ? 'var(--accent)' : 'var(--muted)' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto noscrollbar md:flex-wrap">
          {tags.map(t => (
            <button key={t} onClick={() => setActiveTag(t)} className="shrink-0">
              <Chip active={activeTag === t}>{t}</Chip>
            </button>
          ))}
        </div>
      </div>

      <Rule />

      {error && (
        <pre role="alert" className="px-5 md:px-10 py-3 font-mono text-[12px] text-accent whitespace-pre-wrap select-all border-b border-rule">
          {error}
        </pre>
      )}

      {/* desktop column header */}
      <div className="hidden md:grid md:grid-cols-[1fr_120px_120px_160px] md:gap-4 md:px-10 md:py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
        <span>title</span>
        <span>added</span>
        <span>reviewed</span>
        <span>strength</span>
      </div>
      <div className="hidden md:block"><Rule /></div>

      {/* ── LIST ── */}
      <div className="md:flex-1 md:overflow-y-auto md:thinbar">
        {filtered.length === 0 && (
          <div className="px-5 md:px-10 py-8 font-mono text-[13px] text-dim">No notes match.</div>
        )}

        <ul>
          {filtered.map((n, i) => (
            <li key={n.id}>
              <button
                onClick={() => navigate(`/note/${n.id}`)}
                className="w-full text-left px-5 md:px-10 py-4 hover:bg-ink-2 transition-colors md:grid md:grid-cols-[1fr_120px_120px_160px] md:gap-4 md:items-center"
              >
                {/* Title + tag: flex layout on mobile, grid cell on desktop */}
                <div className="flex items-start justify-between gap-4 md:block">
                  <div className="min-w-0">
                    <Tag>{n.tag}</Tag>
                    <div className="mt-1 font-sans text-[15px] leading-snug md:truncate">{n.title}</div>
                    {/* dates: visible on mobile inline, hidden on desktop (shown in grid cols 2-3) */}
                    <div className="mt-2 md:hidden font-mono text-[11px] text-muted uppercase tracking-wider">
                      added {ageLabel(n.created_at)} · reviewed {reviewedLabel(n.last_reviewed_at)}
                    </div>
                    {/* strength: visible on mobile inline, hidden on desktop (shown in grid col 4) */}
                    <div className="mt-2 md:hidden">
                      {n.last_rating != null && <StrengthBar value={n.last_rating} />}
                    </div>
                  </div>
                  {/* arrow: mobile only */}
                  <div className="font-mono text-[11px] text-dim pt-1 md:hidden">→</div>
                </div>

                {/* added: hidden on mobile (no room), visible on desktop as grid col 2 */}
                <span className="hidden md:block font-mono text-[12px] text-muted uppercase tracking-wider">
                  {ageLabel(n.created_at)}
                </span>

                {/* reviewed: hidden on mobile (no room), visible on desktop as grid col 3 */}
                <span className="hidden md:block font-mono text-[12px] text-muted uppercase tracking-wider">
                  {reviewedLabel(n.last_reviewed_at)}
                </span>

                {/* strength: hidden on mobile (shown inline above), visible on desktop as grid col 4 */}
                <div className="hidden md:block">
                  {n.last_rating != null
                    ? <StrengthBar value={n.last_rating} />
                    : <span className="font-mono text-[12px] text-dim">—</span>}
                </div>
              </button>
              {i < filtered.length - 1 && <Rule dashed />}
            </li>
          ))}
        </ul>

        {filtered.length > 0 && <Rule />}
        <div className="px-5 md:px-10 py-6 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          {notes.length} notes archived
        </div>
      </div>
    </div>
  )
}
