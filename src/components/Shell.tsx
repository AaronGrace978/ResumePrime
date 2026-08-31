import type { ReactNode } from 'react'

export type ViewId = 'resume' | 'jobs' | 'apply' | 'agent' | 'settings'

const NAV: { id: ViewId; label: string; hint: string }[] = [
  { id: 'resume', label: 'Resume', hint: 'Profile vault' },
  { id: 'jobs', label: 'Jobs', hint: 'Radar' },
  { id: 'apply', label: 'Apply', hint: 'Scan & fill' },
  { id: 'agent', label: 'Agent', hint: 'Harness' },
  { id: 'settings', label: 'Settings', hint: 'Models & keys' }
]

export function Shell({
  view,
  onView,
  children,
  aside
}: {
  view: ViewId
  onView: (id: ViewId) => void
  children: ReactNode
  aside: ReactNode
}) {
  return (
    <div className="flex h-full overflow-hidden bg-canvas">
      <nav className="flex w-[220px] shrink-0 flex-col border-r border-line bg-white">
        <div className="px-5 pb-4 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">Job agent</p>
          <h1 className="mt-1 text-[22px] font-bold leading-none tracking-tight text-ink">ResumePrime</h1>
        </div>
        <ul className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = item.id === view
            return (
              <li key={item.id}>
                <button
                  onClick={() => onView(item.id)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                    active ? 'bg-teal-light text-ink' : 'text-muted hover:bg-canvas hover:text-ink'
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-[11px] text-muted">{item.hint}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="px-5 py-4 text-[11px] leading-relaxed text-muted">
          Semi-auto. You confirm every submit.
        </p>
      </nav>
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      {aside}
    </div>
  )
}
