import type {
  AgentEvent,
  AgentRun,
  Application,
  AppSettings,
  FieldMapping,
  FormField,
  Job,
  Profile,
  ProviderId
} from './types'

export interface PrimeAPI {
  settings: {
    get: () => Promise<{ settings: AppSettings; secrets: Record<'ollama' | 'openai' | 'anthropic', boolean> }>
    save: (settings: AppSettings) => Promise<AppSettings>
    saveKey: (name: 'ollama' | 'openai' | 'anthropic', value: string) => Promise<Record<string, boolean>>
    listModels: (provider?: ProviderId) => Promise<string[]>
  }
  resume: {
    get: () => Promise<Profile>
    save: (profile: Profile) => Promise<Profile>
    import: () => Promise<Profile>
    draftCover: (jobId: string) => Promise<{ letter: string; usedPhrases: string[]; warnings: string[] }>
  }
  jobs: {
    list: () => Promise<Job[]>
    ingestUrl: (url: string) => Promise<Job>
    ingestBoard: (url: string) => Promise<Job[]>
    hunt: (query?: string) => Promise<{ query: string; jobs: Job[] }>
    matchOne: (jobId: string) => Promise<Job>
    matchPending: () => Promise<Job[]>
  }
  applications: {
    list: () => Promise<(Application & { job?: Job })[]>
    saveCover: (jobId: string, letter: string) => Promise<Application>
    exportLog: () => Promise<{ ok: boolean; path?: string }>
  }
  agent: {
    start: (goal: string, kind?: string) => Promise<string>
    cancel: (runId: string) => Promise<void>
    answer: (runId: string, answer: string) => Promise<void>
    confirmSubmit: (runId: string, confirmed: boolean) => Promise<unknown>
    runs: () => Promise<AgentRun[]>
    events: (runId: string) => Promise<AgentEvent[]>
    onEvent: (cb: (event: AgentEvent) => void) => () => void
  }
  apply: {
    show: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>
    hide: () => Promise<void>
    navigate: (url: string) => Promise<{ url: string; title: string }>
    url: () => Promise<string>
    back: () => Promise<void>
    forward: () => Promise<void>
    reload: () => Promise<void>
    scan: () => Promise<{
      url: string
      title: string
      fields: FormField[]
      captcha: boolean
      loginHints: boolean
      submitText: string | null
    }>
    fill: (jobId: string, mappings?: FieldMapping[]) => Promise<unknown>
    map: (jobId: string) => Promise<{ scan: { fields: FormField[]; captcha: boolean }; mappings: FieldMapping[] }>
    copy: (text: string) => Promise<void>
  }
}
