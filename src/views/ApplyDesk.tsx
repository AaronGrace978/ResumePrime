import { useEffect, useRef, useState } from 'react'
import type { FieldMapping, Job } from '../../shared/types'
import { Button } from '../components/Button'
import { prime } from '../lib/prime'

export function ApplyDesk({
  jobs,
  activeJobId,
  onJobId
}: {
  jobs: Job[]
  activeJobId: string
  onJobId: (id: string) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState('')
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('Paste an application URL. Scan maps fields. Fill copies your profile. Submit stays with you.')
  const job = jobs.find((j) => j.id === activeJobId)

  useEffect(() => {
    if (job?.url && !url) setUrl(job.url)
  }, [job, url])

  useEffect(() => {
    const el = frameRef.current
    if (!el) return

    const report = () => {
      const r = el.getBoundingClientRect()
      void prime.apply.show({ x: r.left, y: r.top, width: r.width, height: r.height })
    }

    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    window.addEventListener('resize', report)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', report)
      void prime.apply.hide()
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line px-6 py-4">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Apply desk</p>
          <select
            className="ml-auto max-w-xs rounded-lg border border-line px-2 py-1 text-sm outline-none focus:border-teal"
            value={activeJobId}
            onChange={(e) => {
              onJobId(e.target.value)
              const next = jobs.find((j) => j.id === e.target.value)
              if (next) setUrl(next.url)
            }}
          >
            <option value="">No job linked</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} — {j.company}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" onClick={() => prime.apply.back()}>
            Back
          </Button>
          <Button variant="ghost" onClick={() => prime.apply.forward()}>
            Forward
          </Button>
          <input
            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void prime.apply.navigate(url)
            }}
            placeholder="https://boards.greenhouse.io/…"
          />
          <Button onClick={() => prime.apply.navigate(url)}>Go</Button>
          <Button variant="secondary" onClick={() => prime.apply.reload()}>
            Reload
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative bg-[#e8eef5] p-3">
          <div ref={frameRef} className="h-full w-full rounded-xl bg-white shadow-card" />
        </div>
        <aside className="flex flex-col overflow-hidden border-l border-line bg-white">
          <div className="flex gap-2 border-b border-line p-3">
            <Button
              className="flex-1"
              disabled={!!busy}
              onClick={async () => {
                setBusy('scan')
                try {
                  if (activeJobId) {
                    const { mappings: mapped, scan } = await prime.apply.map(activeJobId)
                    setMappings(mapped)
                    setNote(`Mapped ${mapped.length} fields${scan.captcha ? ' · CAPTCHA detected' : ''}.`)
                  } else {
                    const scan = await prime.apply.scan()
                    setMappings(
                      scan.fields.map((f) => ({
                        fieldId: f.id,
                        label: f.label,
                        selector: f.selector,
                        type: f.type,
                        required: f.required,
                        value: f.value,
                        source: 'empty' as const,
                        confidence: 0
                      }))
                    )
                    setNote(`Found ${scan.fields.length} fields. Link a job to auto-map.`)
                  }
                } catch (e) {
                  setNote(String(e))
                } finally {
                  setBusy('')
                }
              }}
            >
              {busy === 'scan' ? 'Scanning…' : 'Scan + map'}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={!mappings.length || !!busy}
              onClick={async () => {
                setBusy('fill')
                try {
                  if (activeJobId) await prime.apply.fill(activeJobId, mappings)
                  setNote('Filled mapped fields. Review the page, then confirm submit in the agent if queued.')
                } catch (e) {
                  setNote(String(e))
                } finally {
                  setBusy('')
                }
              }}
            >
              Fill
            </Button>
          </div>
          <p className="px-3 py-2 text-xs text-muted">{note}</p>
          <ul className="flex-1 overflow-auto px-3 pb-4">
            {mappings.map((m) => (
              <li key={m.fieldId + m.selector} className="mb-2 rounded-lg border border-line p-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-ink">{m.label || m.fieldId}</p>
                  <button
                    className="text-[10px] font-semibold uppercase text-teal"
                    onClick={() => prime.apply.copy(m.value)}
                  >
                    Copy
                  </button>
                </div>
                <input
                  className="mt-1 w-full rounded border border-line px-2 py-1 text-xs outline-none focus:border-teal"
                  value={m.value}
                  onChange={(e) =>
                    setMappings((prev) =>
                      prev.map((x) => (x.selector === m.selector ? { ...x, value: e.target.value } : x))
                    )
                  }
                />
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">
                  {m.source} · {Math.round(m.confidence * 100) || 0}%
                </p>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-3">
            <p className="text-[11px] leading-relaxed text-muted">
              Submit is never automatic. Queue it from the agent, then confirm.
            </p>
            {activeJobId && (
              <Button
                className="mt-2 w-full"
                variant="secondary"
                onClick={() =>
                  prime.agent.start(
                    `The application page is open for job ${activeJobId}. Scan the page, map fields, fill them from the profile, draft a cover letter if missing, then queue_submit for confirmation.`
                  )
                }
              >
                Agent: scan, fill, queue
              </Button>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
