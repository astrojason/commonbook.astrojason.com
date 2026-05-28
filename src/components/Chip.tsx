import { ReactNode } from 'react'

interface ChipProps {
  children: ReactNode
  active?: boolean
}

export function Chip({ children, active }: ChipProps) {
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-[3px] border ${
        active
          ? 'bg-accent text-ink border-accent'
          : 'bg-transparent text-muted border-rule'
      }`}
    >
      {children}
    </span>
  )
}
