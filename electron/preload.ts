import { contextBridge, ipcRenderer } from 'electron'
import type { AgentEvent, AppSettings, FieldMapping, Profile } from '../shared/types'
import type { PrimeAPI } from '../shared/prime-api'

const api: PrimeAPI = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
    saveKey: (name: 'ollama' | 'openai' | 'anthropic', value: string) =>
      ipcRenderer.invoke('settings:saveKey', name, value),
    listModels: (provider?: 'ollama' | 'openai' | 'anthropic') =>
      ipcRenderer.invoke('settings:listModels', provider)
  },
  resume: {
    get: () => ipcRenderer.invoke('resume:get'),
    save: (profile: Profile) => ipcRenderer.invoke('resume:save', profile),
    import: () => ipcRenderer.invoke('resume:import'),
    draftCover: (jobId: string) => ipcRenderer.invoke('resume:draftCover', jobId)
  },
  jobs: {
    list: () => ipcRenderer.invoke('jobs:list'),
    ingestUrl: (url: string) => ipcRenderer.invoke('jobs:ingestUrl', url),
    ingestBoard: (url: string) => ipcRenderer.invoke('jobs:ingestBoard', url),
    hunt: (query?: string) => ipcRenderer.invoke('jobs:hunt', query),
    matchOne: (jobId: string) => ipcRenderer.invoke('jobs:matchOne', jobId),
    matchPending: () => ipcRenderer.invoke('jobs:matchPending')
  },
  applications: {
    list: () => ipcRenderer.invoke('applications:list'),
    saveCover: (jobId: string, letter: string) =>
      ipcRenderer.invoke('applications:saveCover', jobId, letter),
    exportLog: () => ipcRenderer.invoke('applications:export')
  },
  agent: {
    start: (goal: string, kind?: string) => ipcRenderer.invoke('agent:start', goal, kind),
    cancel: (runId: string) => ipcRenderer.invoke('agent:cancel', runId),
    answer: (runId: string, answer: string) => ipcRenderer.invoke('agent:answer', runId, answer),
    confirmSubmit: (runId: string, confirmed: boolean) =>
      ipcRenderer.invoke('agent:confirmSubmit', runId, confirmed),
    runs: () => ipcRenderer.invoke('agent:runs'),
    events: (runId: string) => ipcRenderer.invoke('agent:events', runId),
    onEvent: (cb: (event: AgentEvent) => void) => {
      const listener = (_: unknown, event: AgentEvent) => cb(event)
      ipcRenderer.on('agent:event', listener)
      return () => ipcRenderer.removeListener('agent:event', listener)
    }
  },
  apply: {
    show: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('apply:show', bounds),
    hide: () => ipcRenderer.invoke('apply:hide'),
    navigate: (url: string) => ipcRenderer.invoke('apply:navigate', url),
    url: () => ipcRenderer.invoke('apply:url'),
    back: () => ipcRenderer.invoke('apply:back'),
    forward: () => ipcRenderer.invoke('apply:forward'),
    reload: () => ipcRenderer.invoke('apply:reload'),
    scan: () => ipcRenderer.invoke('apply:scan'),
    fill: (jobId: string, mappings?: FieldMapping[]) =>
      ipcRenderer.invoke('apply:fill', jobId, mappings),
    map: (jobId: string) => ipcRenderer.invoke('apply:map', jobId),
    copy: (text: string) => ipcRenderer.invoke('apply:copy', text)
  }
}

contextBridge.exposeInMainWorld('prime', api)
