import { useEffect, useState } from 'react'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function Spinner({ className = '' }: { className?: string }) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % FRAMES.length), 80)
    return () => clearInterval(t)
  }, [])

  return (
    <span aria-hidden="true" className={`inline-block w-[1ch] text-accent ${className}`}>
      {FRAMES[frame]}
    </span>
  )
}
