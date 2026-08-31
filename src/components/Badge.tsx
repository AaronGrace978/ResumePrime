import type { AiFilterFlag } from '../../shared/types'
import { flagLabel } from '../../shared/ai-filter'

export function AiBadge({ flag }: { flag: AiFilterFlag }) {
  const cls =
    flag === 'likely_ai'
      ? 'bg-rose-50 text-danger border-rose-200'
      : flag === 'human_likely'
        ? 'bg-teal-light text-teal-dark border-teal/20'
        : 'bg-slate-100 text-muted border-line'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}>
      {flagLabel(flag)}
    </span>
  )
}

export function ScorePill({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs font-medium text-muted">Unscored</span>
  }
  const color = score >= 71 ? 'text-teal-dark' : score >= 41 ? 'text-warn' : 'text-danger'
  return (
    <span className={`text-lg font-bold tabular-nums ${color}`}>
      {Math.round(score)}
      <span className="text-xs font-semibold text-muted">%</span>
    </span>
  )
}
