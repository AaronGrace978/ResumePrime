import { useState } from 'react'
import type { Job } from '../../shared/types'
import { AiBadge, ScorePill } from '../components/Badge'
import { Button } from '../components/Button'
import { prime } from '../lib/prime'

export function JobRadar({
  jobs,
  selectedId,
  onSelect,
  onRefresh,
  onApply
}: {
  jobs: Job[]
  selectedId: string
  onSelect: (id: string) => void
  onRefresh: () => Promise<void>
  onApply: (job: Job) => void
}) {
  const [query, setQuery] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const selected = jobs.find((j) => j.id === selectedId) ?? jobs[0]

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line px-8 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Job radar</p>
        <h2 className="text-2xl font-bold text-ink">Hunt by your skills</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="min-w-[220px] flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
            placeholder="Query — or leave blank to use profile skills"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            disabled={!!busy}
            onClick={async () => {
              setBusy('hunt')
              setError('')
              try {
                await prime.jobs.hunt(query)
                await onRefresh()
              } catch (e) {
                setError(String(e))
              } finally {
                setBusy('')
              }
            }}
          >
            {busy === 'hunt' ? 'Hunting…' : 'Hunt jobs'}
          </Button>
          <Button
            variant="secondary"
            disabled={!!busy}
            onClick={async () => {
              setBusy('match')
              try {
                await prime.jobs.matchPending()
                await onRefresh()
              } finally {
                setBusy('')
              }
            }}
          >
            {busy === 'match' ? 'Scoring…' : 'Score + flag'}
          </Button>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
            placeholder="Paste job URL or Greenhouse/Lever board"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={!url || !!busy}
            onClick={async () => {
              setBusy('ingest')
              setError('')
              try {
                if (/greenhouse|lever/i.test(url)) await prime.jobs.ingestBoard(url)
                else await prime.jobs.ingestUrl(url)
                await onRefresh()
                setUrl('')
              } catch (e) {
                setError(String(e))
              } finally {
                setBusy('')
              }
            }}
          >
            Add
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px]">
        <ul className="overflow-auto">
          {jobs.length === 0 && (
            <li className="px-8 py-10 text-sm text-muted">No jobs yet. Hunt, or paste a board URL.</li>
          )}
          {jobs.map((job) => (
            <li key={job.id}>
              <button
                onClick={() => onSelect(job.id)}
                className={`flex w-full items-start justify-between gap-4 border-b border-line px-8 py-4 text-left hover:bg-white ${
                  selected?.id === job.id ? 'bg-white' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{job.title}</p>
                  <p className="truncate text-sm text-muted">
                    {job.company} · {job.location || job.source}
                  </p>
                  <div className="mt-2">
                    <AiBadge flag={job.aiFilterFlag} />
                  </div>
                </div>
                <ScorePill score={job.matchScore} />
              </button>
            </li>
          ))}
        </ul>
        <aside className="overflow-auto border-l border-line bg-white p-6">
          {selected ? (
            <>
              <AiBadge flag={selected.aiFilterFlag} />
              <h3 className="mt-3 text-xl font-bold leading-snug">{selected.title}</h3>
              <p className="text-sm text-muted">
                {selected.company} · {selected.location}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink">{selected.aiFilterReason}</p>
              {selected.matchRationale && (
                <p className="mt-2 text-sm leading-relaxed text-muted">{selected.matchRationale}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => onApply(selected)}>Open in Apply</Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await prime.jobs.matchOne(selected.id)
                    await onRefresh()
                  }}
                >
                  Rescore
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    prime.agent.start(
                      `Pursue this job ruthlessly: ${selected.title} at ${selected.company} (id ${selected.id}, ${selected.url}). Score it, flag AI filters, draft a cover letter in the user's words, and if an application page is open, scan and map fields. Do not submit.`
                    )
                  }
                >
                  Agent pursue
                </Button>
              </div>
              <p className="mt-5 text-[13px] leading-relaxed text-muted">
                {selected.jdText.slice(0, 1800) || 'No description captured yet.'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Select a role.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
