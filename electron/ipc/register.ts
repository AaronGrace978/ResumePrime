import { dialog, ipcMain, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import type { AppSettings, FieldMapping, Profile } from '../../shared/types'
import { answerAsk, cancelRun, confirmQueuedSubmit, startAgentRun } from '../agent/loop'
import {
  applyUrl,
  copyText,
  fillMapped,
  goBack,
  goForward,
  hideApplyView,
  navigateApply,
  reload,
  scanPage,
  showApplyView
} from '../browser/controller'
import {
  getApplicationForJob,
  getJob,
  getProfile,
  getSettings,
  listApplications,
  listEvents,
  listJobs,
  listRuns,
  saveProfile,
  saveSettings,
  upsertApplication
} from '../db/store'
import { matchAndFlagJob, matchOpenJobs } from '../jobs/match'
import { huntJobs, ingestBoard, ingestUrl } from '../jobs/sources'
import { mapFormFields, draftCoverLetter, inventedClaimCheck } from '../llm/harness'
import { listModels } from '../llm/registry'
import { importAndParseResume } from '../resume/parse'
import { saveSecret, secretStatus, type SecretName } from '../secrets'

export function registerIpc(_win: BrowserWindow): void {
  ipcMain.handle('settings:get', () => ({
    settings: getSettings(),
    secrets: secretStatus()
  }))

  ipcMain.handle('settings:save', (_e, settings: AppSettings) => {
    saveSettings(settings)
    return getSettings()
  })

  ipcMain.handle('settings:saveKey', (_e, name: SecretName, value: string) => {
    if (value.trim()) saveSecret(name, value.trim())
    return secretStatus()
  })

  ipcMain.handle('settings:listModels', (_e, provider?: 'ollama' | 'openai' | 'anthropic') =>
    listModels(provider)
  )

  ipcMain.handle('resume:get', () => getProfile())

  ipcMain.handle('resume:save', (_e, profile: Profile) => saveProfile(profile))

  ipcMain.handle('resume:import', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const picked = await dialog.showOpenDialog(win ?? (_win as BrowserWindow), {
      title: 'Import resume',
      filters: [
        { name: 'Resume', extensions: ['pdf', 'docx', 'txt', 'md'] },
        { name: 'All files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (picked.canceled || !picked.filePaths[0]) return getProfile()
    return importAndParseResume(picked.filePaths[0])
  })

  ipcMain.handle('resume:draftCover', async (_e, jobId: string) => {
    const job = getJob(jobId)
    if (!job) throw new Error('Job not found')
    const profile = getProfile()
    const draft = await draftCoverLetter(profile, job.title, job.company, job.jdText)
    const warnings = inventedClaimCheck(draft.letter, profile)
    const app = upsertApplication({ jobId, status: 'drafted', coverLetter: draft.letter })
    return { ...draft, warnings, application: app }
  })

  ipcMain.handle('jobs:list', () => listJobs())

  ipcMain.handle('jobs:ingestUrl', (_e, url: string) => ingestUrl(url))

  ipcMain.handle('jobs:ingestBoard', (_e, url: string) => ingestBoard(url))

  ipcMain.handle('jobs:hunt', async (_e, query?: string) => {
    const settings = getSettings()
    const profile = getProfile()
    const q =
      query?.trim() ||
      settings.huntQuery ||
      profile.skills.slice(0, 6).join(' ') ||
      profile.experience[0]?.title ||
      ''
    const jobs = await huntJobs(q, settings.boardUrls)
    try {
      await matchOpenJobs(8)
    } catch {
      /* scoring is best-effort */
    }
    return { query: q, jobs: listJobs() }
  })

  ipcMain.handle('jobs:matchOne', async (_e, jobId: string) => {
    const job = getJob(jobId)
    if (!job) throw new Error('Job not found')
    return matchAndFlagJob(job)
  })

  ipcMain.handle('jobs:matchPending', () => matchOpenJobs(20))

  ipcMain.handle('applications:list', () => listApplications())

  ipcMain.handle('applications:saveCover', (_e, jobId: string, letter: string) =>
    upsertApplication({ jobId, status: 'drafted', coverLetter: letter })
  )

  ipcMain.handle('applications:export', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const picked = await dialog.showSaveDialog(win ?? _win, {
      title: 'Export application log',
      defaultPath: 'resumeprime-log.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (picked.canceled || !picked.filePath) return { ok: false }
    const payload = {
      exportedAt: new Date().toISOString(),
      jobs: listJobs(),
      applications: listApplications(),
      runs: listRuns(100)
    }
    await writeFile(picked.filePath, JSON.stringify(payload, null, 2), 'utf8')
    return { ok: true, path: picked.filePath }
  })

  ipcMain.handle('agent:start', (_e, goal: string, kind?: string) => startAgentRun(goal, kind ?? 'agent'))
  ipcMain.handle('agent:cancel', (_e, runId: string) => cancelRun(runId))
  ipcMain.handle('agent:answer', (_e, runId: string, answer: string) => answerAsk(runId, answer))
  ipcMain.handle('agent:confirmSubmit', (_e, runId: string, confirmed: boolean) =>
    confirmQueuedSubmit(runId, confirmed)
  )
  ipcMain.handle('agent:runs', () => listRuns())
  ipcMain.handle('agent:events', (_e, runId: string) => listEvents(runId))

  ipcMain.handle('apply:show', (_e, bounds: { x: number; y: number; width: number; height: number }) => {
    showApplyView(bounds)
  })
  ipcMain.handle('apply:hide', () => hideApplyView())
  ipcMain.handle('apply:navigate', (_e, url: string) => navigateApply(url))
  ipcMain.handle('apply:url', () => applyUrl())
  ipcMain.handle('apply:back', () => goBack())
  ipcMain.handle('apply:forward', () => goForward())
  ipcMain.handle('apply:reload', () => reload())
  ipcMain.handle('apply:scan', () => scanPage())
  ipcMain.handle('apply:fill', async (_e, jobId: string, mappings?: FieldMapping[]) => {
    const map = mappings ?? getApplicationForJob(jobId)?.fieldMap ?? []
    const result = await fillMapped(map)
    upsertApplication({ jobId, status: 'filled', fieldMap: map })
    return result
  })
  ipcMain.handle('apply:map', async (_e, jobId: string) => {
    const scan = await scanPage()
    const profile = getProfile()
    const app = getApplicationForJob(jobId)
    const mappings = await mapFormFields(profile, scan.fields, app?.coverLetter)
    upsertApplication({ jobId, status: 'filled', fieldMap: mappings })
    return { scan, mappings }
  })
  ipcMain.handle('apply:copy', (_e, text: string) => copyText(text))
}
