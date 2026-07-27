import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface ChangelogEntry {
  hash: string
  message: string
  date: string
}

interface ChangelogData {
  version: string
  entries: ChangelogEntry[]
}

export default function Changelog() {
  const [data, setData] = useState<ChangelogData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/changelog')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`)
        return r.json() as Promise<ChangelogData>
      })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full overflow-y-auto noscrollbar px-5 py-6 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted hover:text-accent transition-colors"
        >
          ← back
        </Link>
        <span className="font-mono text-[11px] text-dim">/</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">changelog</span>
      </div>

      <div className="mb-8">
        <h1 className="font-mono text-[15px] uppercase tracking-[0.2em] font-medium">changelog</h1>
        {data && (
          <div className="mt-1 font-mono text-[11px] text-dim uppercase tracking-[0.18em]">
            v{data.version}
          </div>
        )}
      </div>

      {loading && (
        <div className="font-mono text-[12px] text-muted">loading…</div>
      )}

      {error && (
        <pre className="font-mono text-[11px] text-accent bg-ink-2 border border-rule p-4 select-all whitespace-pre-wrap break-all">
          {error}
        </pre>
      )}

      {data && (
        <div className="flex flex-col gap-0">
          {data.entries.map((entry) => (
            <div
              key={entry.hash}
              className="flex items-start gap-4 py-3 border-b border-rule last:border-0"
            >
              <span className="font-mono text-[10px] text-dim shrink-0 pt-[2px] w-16">{entry.date}</span>
              <span className="font-mono text-[11px] text-dim shrink-0 pt-[2px]">{entry.hash}</span>
              <span className="font-mono text-[12px] text-text leading-relaxed">{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
