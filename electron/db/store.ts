import { randomUUID } from 'node:crypto'
import type {
  AgentEvent,
  AgentRun,
  Application,
  AppSettings,
  FieldMapping,
  Job,
  Profile
} from '../../shared/types'
import { DEFAULT_SETTINGS as defaults, emptyProfile } from '../../shared/types'
import { all, get, run } from './schema'

export function getSettings(): AppSettings {
  const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['app'])
  if (!row) return { ...defaults, models: { ...defaults.models }, boardUrls: [] }
  try {
    const parsed = JSON.parse(row.value) as Partial<AppSettings>
    return {
      ...defaults,
      ...parsed,
      models: { ...defaults.models, ...parsed.models },
      boardUrls: parsed.boardUrls ?? []
    }
  } catch {
    return { ...defaults, models: { ...defaults.models }, boardUrls: [] }
  }
}

export function saveSettings(settings: AppSettings): void {
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ['app', JSON.stringify(settings)]
  )
}

export function getProfile(): Profile {
  const row = get<{ json: string }>('SELECT json FROM profile WHERE id = ?', ['default'])
  if (!row) return emptyProfile()
  try {
    return { ...emptyProfile(), ...JSON.parse(row.json) }
  } catch {
    return emptyProfile()
  }
}

export function saveProfile(profile: Profile): Profile {
  const next = { ...profile, id: 'default', updatedAt: new Date().toISOString() }
  run(
    'INSERT INTO profile (id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at',
    ['default', JSON.stringify(next), next.updatedAt]
  )
  return next
}

export function listJobs(): Job[] {
  return all<Record<string, unknown>>(
    'SELECT * FROM jobs ORDER BY COALESCE(match_score, -1) DESC, created_at DESC'
  ).map(rowToJob)
}

export function getJob(id: string): Job | null {
  const row = get<Record<string, unknown>>('SELECT * FROM jobs WHERE id = ?', [id])
  return row ? rowToJob(row) : null
}

export function upsertJob(job: Omit<Job, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Job {
  const existing = get<{ id: string; created_at: string }>('SELECT id, created_at FROM jobs WHERE url = ?', [
    job.url
  ])
  const id = existing?.id ?? job.id ?? randomUUID()
  const createdAt = existing?.created_at ?? job.createdAt ?? new Date().toISOString()
  const full: Job = { ...job, id, createdAt }
  run(
    `INSERT INTO jobs (id, source, url, company, title, location, jd_text, match_score, match_rationale, ai_filter_flag, ai_filter_reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       company = excluded.company,
       title = excluded.title,
       location = excluded.location,
       jd_text = excluded.jd_text,
       match_score = excluded.match_score,
       match_rationale = excluded.match_rationale,
       ai_filter_flag = excluded.ai_filter_flag,
       ai_filter_reason = excluded.ai_filter_reason`,
    [
      full.id,
      full.source,
      full.url,
      full.company,
      full.title,
      full.location,
      full.jdText,
      full.matchScore,
      full.matchRationale,
      full.aiFilterFlag,
      full.aiFilterReason,
      full.createdAt
    ]
  )
  return full
}

export function listApplications(): (Application & { job?: Job })[] {
  return all<Record<string, unknown>>('SELECT * FROM applications ORDER BY updated_at DESC').map((r) => {
    const app = rowToApp(r)
    return { ...app, job: getJob(app.jobId) ?? undefined }
  })
}

export function getApplicationForJob(jobId: string): Application | null {
  const row = get<Record<string, unknown>>('SELECT * FROM applications WHERE job_id = ?', [jobId])
  return row ? rowToApp(row) : null
}

export function upsertApplication(partial: {
  jobId: string
  status?: Application['status']
  coverLetter?: string | null
  fieldMap?: FieldMapping[] | null
}): Application {
  const existing = getApplicationForJob(partial.jobId)
  const app: Application = {
    id: existing?.id ?? randomUUID(),
    jobId: partial.jobId,
    status: partial.status ?? existing?.status ?? 'discovered',
    coverLetter: partial.coverLetter !== undefined ? partial.coverLetter : existing?.coverLetter ?? null,
    fieldMap: partial.fieldMap !== undefined ? partial.fieldMap : existing?.fieldMap ?? null,
    updatedAt: new Date().toISOString()
  }
  run(
    `INSERT INTO applications (id, job_id, status, cover_letter, field_map, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       cover_letter = excluded.cover_letter,
       field_map = excluded.field_map,
       updated_at = excluded.updated_at`,
    [
      app.id,
      app.jobId,
      app.status,
      app.coverLetter,
      app.fieldMap ? JSON.stringify(app.fieldMap) : null,
      app.updatedAt
    ]
  )
  return app
}

export function insertRun(kind: string, input: string): AgentRun {
  const runRow: AgentRun = {
    id: randomUUID(),
    kind,
    status: 'running',
    input,
    output: null,
    createdAt: new Date().toISOString()
  }
  run('INSERT INTO agent_runs (id, kind, status, input, output, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    runRow.id,
    runRow.kind,
    runRow.status,
    runRow.input,
    runRow.output,
    runRow.createdAt
  ])
  return runRow
}

export function updateRun(id: string, patch: Partial<Pick<AgentRun, 'status' | 'output'>>): void {
  const row = get<Record<string, unknown>>('SELECT * FROM agent_runs WHERE id = ?', [id])
  if (!row) return
  const status = patch.status ?? (row.status as string)
  const output = patch.output !== undefined ? patch.output : (row.output as string | null)
  run('UPDATE agent_runs SET status = ?, output = ? WHERE id = ?', [status, output, id])
}

export function listRuns(limit = 40): AgentRun[] {
  return all<Record<string, unknown>>(
    'SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT ?',
    [limit]
  ).map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    status: r.status as AgentRun['status'],
    input: String(r.input),
    output: (r.output as string | null) ?? null,
    createdAt: String(r.created_at)
  }))
}

export function nextEventSeq(runId: string): number {
  const row = get<{ m: number | null }>('SELECT MAX(seq) as m FROM agent_events WHERE run_id = ?', [runId])
  return (row?.m ?? 0) + 1
}

export function insertEvent(event: Omit<AgentEvent, 'seq' | 'createdAt'> & { seq?: number }): AgentEvent {
  const seq = event.seq ?? nextEventSeq(event.runId)
  const full: AgentEvent = {
    ...event,
    seq,
    createdAt: new Date().toISOString()
  }
  run('INSERT INTO agent_events (id, run_id, seq, type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    randomUUID(),
    full.runId,
    full.seq,
    full.type,
    JSON.stringify(full.payload),
    full.createdAt
  ])
  return full
}

export function listEvents(runId: string): AgentEvent[] {
  return all<Record<string, unknown>>(
    'SELECT * FROM agent_events WHERE run_id = ? ORDER BY seq ASC',
    [runId]
  ).map((r) => ({
    runId: String(r.run_id),
    seq: Number(r.seq),
    type: r.type as AgentEvent['type'],
    payload: JSON.parse(String(r.payload)),
    createdAt: String(r.created_at)
  }))
}

export function saveSecretBlob(name: string, value: Uint8Array): void {
  run(
    'INSERT INTO secrets (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [name, value]
  )
}

export function getSecretBlob(name: string): Buffer | null {
  const row = get<{ value: Uint8Array | number[] | string }>('SELECT value FROM secrets WHERE key = ?', [name])
  if (!row?.value) return null
  if (Buffer.isBuffer(row.value)) return row.value
  if (row.value instanceof Uint8Array) return Buffer.from(row.value)
  if (Array.isArray(row.value)) return Buffer.from(row.value)
  return Buffer.from(String(row.value), 'utf8')
}

function rowToJob(r: Record<string, unknown>): Job {
  return {
    id: String(r.id),
    source: String(r.source),
    url: String(r.url),
    company: String(r.company),
    title: String(r.title),
    location: String(r.location ?? ''),
    jdText: String(r.jd_text ?? ''),
    matchScore: r.match_score == null ? null : Number(r.match_score),
    matchRationale: (r.match_rationale as string | null) ?? null,
    aiFilterFlag: (r.ai_filter_flag as Job['aiFilterFlag']) ?? 'unknown',
    aiFilterReason: (r.ai_filter_reason as string | null) ?? null,
    createdAt: String(r.created_at)
  }
}

function rowToApp(r: Record<string, unknown>): Application {
  return {
    id: String(r.id),
    jobId: String(r.job_id),
    status: r.status as Application['status'],
    coverLetter: (r.cover_letter as string | null) ?? null,
    fieldMap: r.field_map ? (JSON.parse(String(r.field_map)) as FieldMapping[]) : null,
    updatedAt: String(r.updated_at)
  }
}
