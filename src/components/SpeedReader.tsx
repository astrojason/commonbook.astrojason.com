import { useEffect, useMemo, useState } from 'react'
import { focalIndex, tokenize } from '../lib/rsvp'

const DEFAULT_WPM = 300
const MIN_WPM = 100
const MAX_WPM = 1000
const WPM_STEP = 25

interface Props {
  text: string
  onClose: () => void
}

export function SpeedReader({ text, onClose }: Props) {
  const words = useMemo(() => tokenize(text), [text])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [wpm, setWpm] = useState(DEFAULT_WPM)

  const last = words.length - 1

  useEffect(() => {
    if (!playing) return
    if (index >= last) { setPlaying(false); return }
    const t = setTimeout(() => setIndex(i => i + 1), 60_000 / wpm)
    return () => clearTimeout(t)
  }, [playing, index, wpm, last])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === ' ') { e.preventDefault(); togglePlay() }
      else if (e.key === 'r' || e.key === 'R') restart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function togglePlay() {
    if (words.length === 0) return
    if (!playing && index >= last) setIndex(0)
    setPlaying(p => !p)
  }

  function restart() {
    setIndex(0)
    setPlaying(false)
  }

  function changeWpm(delta: number) {
    setWpm(w => Math.min(MAX_WPM, Math.max(MIN_WPM, w + delta)))
  }

  const word = words[index] ?? ''
  const f = focalIndex(word)
  const progress = last > 0 ? Math.round((index / last) * 100) : words.length ? 100 : 0
  const btn = 'font-mono text-[12px] uppercase tracking-[0.14em] px-3 py-3 border border-rule text-muted hover:border-rule-2'

  return (
    <div role="dialog" aria-label="Speed reader" className="fixed inset-0 z-50 bg-ink flex flex-col">
      <div className="px-5 md:px-10 pt-6 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
        <span>Reading at {wpm} WPM</span>
        <button onClick={onClose} aria-label="close" className="hover:text-muted">✕ close</button>
      </div>

      <div className="flex-1 flex items-center justify-center px-5">
        {words.length === 0 ? (
          <div className="font-mono text-dim">Nothing to read.</div>
        ) : (
          <div
            data-testid="rsvp-word"
            aria-live="off"
            className="grid grid-cols-[1fr_auto_1fr] w-full max-w-[900px] font-mono text-[34px] md:text-[56px] leading-none"
            style={{ color: 'var(--text)' }}
          >
            <span className="text-right">{word.slice(0, f)}</span>
            <span style={{ color: 'var(--accent)' }}>{word[f]}</span>
            <span className="text-left">{word.slice(f + 1)}</span>
          </div>
        )}
      </div>

      <div className="px-5 md:px-10 pb-8">
        <div className="h-[2px] w-full" style={{ background: 'var(--rule)' }}>
          <div className="h-full" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
        </div>
        <div className="mt-2 font-mono text-[11px] text-dim">{progress}%</div>

        <div className="mt-5 flex items-center gap-3">
          <button onClick={restart} aria-label="restart" className={btn}>⏮</button>
          <button
            onClick={togglePlay}
            aria-label={playing ? 'pause' : 'play'}
            className="flex-1 md:flex-none font-mono text-[12px] uppercase tracking-[0.14em] px-5 py-3 border border-accent text-accent hover:bg-ink-2"
          >
            {playing ? '❚❚ pause' : '▶ play'}
          </button>
          <button onClick={() => changeWpm(-WPM_STEP)} aria-label="slower" className={btn}>−</button>
          <button onClick={() => changeWpm(WPM_STEP)} aria-label="faster" className={btn}>+</button>
        </div>
        <div className="mt-3 font-mono text-[11px] text-dim">Space = play/pause · R = restart · Esc = close</div>
      </div>
    </div>
  )
}
