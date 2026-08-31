import { useCallback, useEffect, useState } from 'react'
import type { AgentEvent, HumanAsk, Job, Profile } from '@shared/types'
import { emptyProfile } from '@shared/types'
import { AgentPanel } from './components/AgentPanel'
import { AskUserModal } from './components/AskUserModal'
import { Shell, type ViewId } from './components/Shell'
import { prime } from './lib/prime'
import { AgentView } from './views/AgentView'
import { ApplyDesk } from './views/ApplyDesk'
import { JobRadar } from './views/JobRadar'
import { ResumeStudio } from './views/ResumeStudio'
import { SettingsView } from './views/Settings'

export default function App() {
  const [view, setView] = useState<ViewId>('resume')
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [, setProfile] = useState<Profile>(emptyProfile())
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [ask, setAsk] = useState<HumanAsk | null>(null)

  const refreshJobs = useCallback(async () => {
    const list = await prime.jobs.list()
    setJobs(list)
    setSelectedJobId((id) => id || list[0]?.id || '')
  }, [])

  useEffect(() => {
    void refreshJobs()
    void prime.resume.get().then(setProfile)
    const off = prime.agent.onEvent((event) => {
      setEvents((prev) => [...prev.slice(-200), event])
      if (event.type === 'needs_human') {
        setAsk({
          runId: event.runId,
          question: String(event.payload.question ?? 'Need your input'),
          kind: (event.payload.kind as HumanAsk['kind']) ?? 'generic',
          context: event.payload.context as Record<string, unknown> | undefined
        })
      }
      if (event.type === 'done' || event.type === 'error') {
        void refreshJobs()
      }
    })
    return () => off()
  }, [refreshJobs])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '1') setView('resume')
      if (e.key === '2') setView('jobs')
      if (e.key === '3') setView('apply')
      if (e.key === '4') setView('agent')
      if (e.key === '5') setView('settings')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Shell
      view={view}
      onView={setView}
      aside={
        <AgentPanel
          events={events}
          ask={view === 'agent' ? null : ask}
          onClearAsk={() => setAsk(null)}
        />
      }
    >
      {view === 'resume' && <ResumeStudio jobs={jobs} onProfile={setProfile} />}
      {view === 'jobs' && (
        <JobRadar
          jobs={jobs}
          selectedId={selectedJobId}
          onSelect={setSelectedJobId}
          onRefresh={refreshJobs}
          onApply={(job) => {
            setSelectedJobId(job.id)
            setView('apply')
          }}
        />
      )}
      {view === 'apply' && (
        <ApplyDesk jobs={jobs} activeJobId={selectedJobId} onJobId={setSelectedJobId} />
      )}
      {view === 'agent' && (
        <AgentView
          events={events}
          onGoal={(goal) => {
            void prime.agent.start(goal)
          }}
        />
      )}
      {view === 'settings' && <SettingsView />}
      {ask && view === 'agent' && <AskUserModal ask={ask} onClose={() => setAsk(null)} />}
    </Shell>
  )
}
