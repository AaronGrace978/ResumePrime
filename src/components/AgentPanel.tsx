import { useEffect, useMemo, useState } from 'react'
import type { AgentEvent, HumanAsk } from '../../shared/types'
import { prime } from '../lib/prime'
import { Button } from './Button'

export function AgentPanel({
  events,
  ask,
  onClearAsk
}: {
  events: AgentEvent[]
  ask: HumanAsk | null
  onClearAsk: () => void
}) {
  const [answer, setAnswer] = useState('')
  const latest = events.slice(-24).reverse()
  const running = useMemo(
    () => events.some((e) => e.type === 'run_start') && !events.some((e) => e.type === 'done' || e.type === 'error'),
    [events]
  )

  useEffect(() => {
    setAnswer('')
  }, [ask?.runId, ask?.question])

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Agent</p>
          <p className="text-sm font-semibold text-ink">{running ? 'In pursuit' : 'Standing by'}</p>
        </div>
        <span className={`h-2.5 w-2.5 rounded-full ${running ? 'animate-pulse bg-teal' : 'bg-line'}`} />
      </div>

      {ask && (
        <div className="border-b border-line bg-teal-light/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-dark">{ask.kind.replace('_', ' ')}</p>
          <p className="mt-1 text-sm font-medium text-ink">{ask.question}</p>
          {ask.kind === 'confirm_submit' ? (
            <div className="mt-3 flex gap-2">
              <Button
                className="flex-1"
                onClick={async () => {
                  await prime.agent.confirmSubmit(ask.runId, true)
                  onClearAsk()
                }}
              >
                Confirm submit
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await prime.agent.confirmSubmit(ask.runId, false)
                  onClearAsk()
                }}
              >
                Hold
              </Button>
            </div>
          ) : (
            <form
              className="mt-3 space-y-2"
              onSubmit={async (e) => {
                e.preventDefault()
                await prime.agent.answer(ask.runId, answer || 'Continue')
                onClearAsk()
              }}
            >
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
                placeholder="Reply to the agent"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto px-3 py-3">
        {latest.length === 0 && (
          <p className="px-1 text-sm text-muted">Hunt, parse, fill — live tool steps show up here.</p>
        )}
        <ol className="space-y-2">
          {latest.map((e) => (
            <li key={`${e.runId}-${e.seq}`} className="rounded-lg border border-line/80 bg-canvas px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{e.type.replace('_', ' ')}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink">{label(e)}</p>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}

function label(e: AgentEvent): string {
  const p = e.payload
  if (typeof p.text === 'string') return p.text
  if (typeof p.output === 'string') return p.output
  if (typeof p.message === 'string') return p.message
  if (typeof p.question === 'string') return p.question
  if (typeof p.name === 'string') return String(p.name)
  if (typeof p.goal === 'string') return p.goal
  return JSON.stringify(p).slice(0, 140)
}
