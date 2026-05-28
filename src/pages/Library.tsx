import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeToNotes } from '../lib/notes'
import { Rule } from '../components/Rule'
import { Tag } from '../components/Tag'
import { Chip } from '../components/Chip'
import { StrengthBar } from '../components/StrengthBar'
import type { Note } from '../types'

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

export default function Library() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[]>([])
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState('all')
  const [sort, setSort] = useState<SortKey>('recent')

  useEffect(() => subscribeToNotes(setNotes), [])

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
    <div className="pt-6 pb-24">
      <div className="px-5 flex items-baseline justify-between">
        <h1 className="font-sans text-[24px] font-light tracking-tight">Library</h1>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
          {filtered.length} / {notes.length}
        </div>
      </div>

      {/* search */}
      <div className="px-5 mt-5">
        <div className="flex items-center gap-3 border-b border-rule pb-2">
          <span className="font-mono text-[12px]" style={{ color: 'var(--accent)' }}>/</span>
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
              className="font-mono text-[10px] text-dim hover:text-muted"
            >
              clr
            </button>
          )}
        </div>
      </div>

      {/* tag filter */}
      <div className="mt-4 px-5 flex gap-2 overflow-x-auto noscrollbar">
        {tags.map(t => (
          <button key={t} onClick={() => setActiveTag(t)} className="shrink-0">
            <Chip active={activeTag === t}>{t}</Chip>
          </button>
        ))}
      </div>

      {/* sort */}
      <div className="mt-4 px-5 flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em]">
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

      <div className="mt-5"><Rule /></div>

      {filtered.length === 0 && (
        <div className="px-5 py-8 font-mono text-[12px] text-dim">No notes match.</div>
      )}

      <ul>
        {filtered.map((n, i) => (
          <li key={n.id}>
            <button
              onClick={() => navigate(`/note/${n.id}`)}
              className="w-full text-left px-5 py-4 hover:bg-ink-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Tag>{n.tag}</Tag>
                  <div className="mt-1 font-sans text-[15px] leading-snug">{n.title}</div>
                  {n.last_rating != null && (
                    <div className="mt-2">
                      <StrengthBar value={n.last_rating} />
                    </div>
                  )}
                </div>
                <div className="font-mono text-[10px] text-dim pt-1">→</div>
              </div>
            </button>
            {i < filtered.length - 1 && <Rule dashed />}
          </li>
        ))}
      </ul>

      {filtered.length > 0 && <Rule />}
    </div>
  )
}
