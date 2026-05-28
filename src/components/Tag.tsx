import { ReactNode } from 'react'

interface TagProps {
  children: ReactNode
}

export function Tag({ children }: TagProps) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
      {children}
    </span>
  )
}
