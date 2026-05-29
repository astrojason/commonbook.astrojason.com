const TIERS = ['cold', 'cool', 'warm', 'hot', 'solid'] as const

interface StrengthBarProps {
  value: number
  size?: 'sm' | 'lg'
  showLabel?: boolean
}

export function StrengthBar({ value, size = 'sm', showLabel = true }: StrengthBarProps) {
  const segClass = size === 'lg' ? 'w-5 h-[3px]' : 'w-3 h-[2px]'
  return (
    <div className="inline-flex items-center gap-2">
      <div className="flex gap-[3px]">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            data-testid="segment"
            data-filled={i <= value ? 'true' : 'false'}
            className={segClass}
            style={{ background: i <= value ? 'var(--accent)' : 'var(--rule-2)' }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {TIERS[value - 1]}
        </span>
      )}
    </div>
  )
}
