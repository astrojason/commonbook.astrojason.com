interface RuleProps {
  dashed?: boolean
}

export function Rule({ dashed }: RuleProps) {
  if (dashed) return <div className="dashed-rule" />
  return <div className="h-px w-full bg-rule" />
}
