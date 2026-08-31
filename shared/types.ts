export type ProviderId = 'ollama' | 'openai' | 'anthropic'

export type TaskKind =
  | 'resume.parse'
  | 'cover.draft'
  | 'job.match'
  | 'form.map'
  | 'aiFilter.detect'
  | 'agent'

export type AiFilterFlag = 'likely_ai' | 'human_likely' | 'unknown'

export type ApplicationStatus =
  | 'discovered'
  | 'matched'
  | 'drafted'
  | 'filled'
  | 'submitted'
  | 'blocked'

export interface Experience {
  company: string
  title: string
  start: string
  end: string
  location?: string
  bullets: string[]
}

export interface Education {
  school: string
  degree: string
  year: string
}

export interface Profile {
  id: string
  fullName: string
  email: string
  phone: string
  location: string
  linkedin: string
  website: string
  summary: string
  skills: string[]
  experience: Experience[]
  education: Education[]
  voiceSamples: string[]
  rawText: string
  updatedAt: string
}

export interface Job {
  id: string
  source: string
  url: string
  company: string
  title: string
  location: string
  jdText: string
  matchScore: number | null
  matchRationale: string | null
  aiFilterFlag: AiFilterFlag
  aiFilterReason: string | null
  createdAt: string
}

export interface Application {
  id: string
  jobId: string
  status: ApplicationStatus
  coverLetter: string | null
  fieldMap: FieldMapping[] | null
  updatedAt: string
}

export interface FieldMapping {
  fieldId: string
  label: string
  selector: string
  type: string
  required: boolean
  value: string
  source: 'profile' | 'generated' | 'user' | 'empty'
  confidence: number
}

export interface FormField {
  id: string
  name: string
  label: string
  type: string
  required: boolean
  value: string
  selector: string
  options?: string[]
}

export interface ModelAssignment {
  'resume.parse': string
  'cover.draft': string
  'job.match': string
  'form.map': string
  'aiFilter.detect': string
  agent: string
}

export interface AppSettings {
  provider: ProviderId
  models: ModelAssignment
  ollamaHost: string
  openaiModel: string
  anthropicModel: string
  boardUrls: string[]
  huntQuery: string
}

export interface AgentEvent {
  runId: string
  seq: number
  type:
    | 'run_start'
    | 'thought'
    | 'tool_call'
    | 'tool_result'
    | 'needs_human'
    | 'status'
    | 'done'
    | 'error'
  payload: Record<string, unknown>
  createdAt: string
}

export interface AgentRun {
  id: string
  kind: string
  status: 'running' | 'needs_human' | 'done' | 'error' | 'cancelled'
  input: string
  output: string | null
  createdAt: string
}

export interface HumanAsk {
  runId: string
  question: string
  kind: 'confirm_submit' | 'login' | 'captcha' | 'ambiguous_field' | 'generic'
  context?: Record<string, unknown>
}

export const DEFAULT_MODELS: ModelAssignment = {
  'resume.parse': 'deepseek-v4-flash',
  'cover.draft': 'kimi-k3',
  'job.match': 'deepseek-v4-flash',
  'form.map': 'glm-5.3',
  'aiFilter.detect': 'deepseek-v4-flash',
  agent: 'glm-5.3'
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'ollama',
  models: DEFAULT_MODELS,
  ollamaHost: 'https://ollama.com',
  openaiModel: 'gpt-4.1',
  anthropicModel: 'claude-sonnet-4-5',
  boardUrls: [],
  huntQuery: ''
}

export function emptyProfile(): Profile {
  return {
    id: 'default',
    fullName: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: '',
    summary: '',
    skills: [],
    experience: [],
    education: [],
    voiceSamples: [],
    rawText: '',
    updatedAt: new Date().toISOString()
  }
}
