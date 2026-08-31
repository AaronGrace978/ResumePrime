import { useEffect, useState } from 'react'
import type { AgentEvent, AgentRun } from '../../shared/types'
import { Button } from '../components/Button'
import { prime } from '../lib/prime'

export function AgentView({
  events,
  onGoal
}: {
  events: AgentEvent[]
  onGoal: (goal: string) => void
}) {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [goal, setGoal] = useState(
    'Read my profile, hunt jobs that match my skills, score them, flag AI filters, and pursue the top matches. Draft cover letters in my words. Do not submit anything without confirmation.'
  )

  useEffect(() => {
    void prime.agent.runs().then(setRuns)
  }, [events])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-line px-8 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Agent harness</p>
        <h2 className="text-2xl font-bold text-ink">Ruthless, with a confirm</h2>
        <textarea
          className="mt-4 h-24 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-teal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <Button onClick={() => onGoal(goal)}>Run agent</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const last = runs.find((r) => r.status === 'running' || r.status === 'needs_human')
              if (last) void prime.agent.cancel(last.id)
            }}
          >
            Cancel active
          </Button>
          <Button variant="ghost" onClick={() => prime.applications.exportLog()}>
            Export log
          </Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-2">
        <ul className="overflow-auto border-r border-line">
          {runs.map((run) => (
            <li key={run.id} className="border-b border-line px-8 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{run.status}</p>
              <p className="mt-1 text-sm font-medium text-ink">{run.input}</p>
              {run.output && <p className="mt-1 text-sm text-muted">{run.output}</p>}
            </li>
          ))}
          {!runs.length && <li className="px-8 py-10 text-sm text-muted">No runs yet.</li>}
        </ul>
        <ol className="overflow-auto bg-white px-6 py-4">
          {events
            .slice()
            .reverse()
            .map((e) => (
              <li key={`${e.runId}-${e.seq}`} className="mb-3 rounded-lg border border-line px-3 py-2">
                <p className="text-[10px] font-semibold uppercase text-muted">{e.type}</p>
                <pre className="mt-1 whitespace-pre-wrap text-[12px] text-ink">
                  {typeof e.payload.text === 'string' ? e.payload.text : JSON.stringify(e.payload, null, 2).slice(0, 500)}
                </pre>
              </li>
            ))}
        </ol>
      </div>
    </div>
  )
}
