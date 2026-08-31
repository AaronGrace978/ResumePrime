import type { ToolDef } from '../llm/types'
import { getProfile, getJob, getSettings, getApplicationForJob, upsertApplication } from '../db/store'
import { huntJobs } from '../jobs/sources'
import { matchAndFlagJob } from '../jobs/match'
import { draftCoverLetter, inventedClaimCheck, mapFormFields } from '../llm/harness'
import { applyUrl, copyText, fillMapped, navigateApply, scanPage } from '../browser/controller'

export const AGENT_TOOLS: ToolDef[] = [
  {
    name: 'read_profile',
    description: 'Read the saved candidate profile (skills, experience, contact, voice samples).',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'search_jobs',
    description: 'Hunt the web for jobs matching a query and configured boards. Returns saved jobs.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Skills or title query. Empty uses profile skills.' }
      }
    }
  },
  {
    name: 'open_job',
    description: 'Open a job application URL in the apply browser.',
    parameters: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        url: { type: 'string' }
      }
    }
  },
  {
    name: 'scan_page',
    description: 'Scan the current apply page for form fields, captchas, and login walls.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'map_fields',
    description: 'Map scanned form fields onto the profile. Pass fields from scan_page.',
    parameters: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        fields: { type: 'array' }
      },
      required: ['fields']
    }
  },
  {
    name: 'fill_fields',
    description: 'Type mapped values into the current page. Does not submit.',
    parameters: {
      type: 'object',
      properties: { jobId: { type: 'string' } },
      required: ['jobId']
    }
  },
  {
    name: 'draft_cover_letter',
    description: 'Draft a cover letter in the candidate’s own words for a job.',
    parameters: {
      type: 'object',
      properties: { jobId: { type: 'string' } },
      required: ['jobId']
    }
  },
  {
    name: 'score_match',
    description: 'Score a job against the profile and refresh AI-filter flag.',
    parameters: {
      type: 'object',
      properties: { jobId: { type: 'string' } },
      required: ['jobId']
    }
  },
  {
    name: 'flag_ai_filter',
    description: 'Re-evaluate whether a company likely uses AI to filter applications.',
    parameters: {
      type: 'object',
      properties: { jobId: { type: 'string' } },
      required: ['jobId']
    }
  },
  {
    name: 'queue_submit',
    description: 'Queue submit for human confirmation. Never silently submit.',
    parameters: {
      type: 'object',
      properties: { jobId: { type: 'string' } },
      required: ['jobId']
    }
  },
  {
    name: 'ask_user',
    description: 'Stop and ask the human for login, captcha, confirm, or an ambiguous field.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        kind: {
          type: 'string',
          enum: ['confirm_submit', 'login', 'captcha', 'ambiguous_field', 'generic']
        }
      },
      required: ['question', 'kind']
    }
  },
  {
    name: 'copy_text',
    description: 'Copy text to the clipboard for sites that block programmatic fill.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text']
    }
  }
]

export type ToolHandlerResult = {
  ok: boolean
  data?: unknown
  needs_human?: {
    question: string
    kind: 'confirm_submit' | 'login' | 'captcha' | 'ambiguous_field' | 'generic'
    context?: Record<string, unknown>
  }
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolHandlerResult> {
  switch (name) {
    case 'read_profile':
      return { ok: true, data: getProfile() }
    case 'search_jobs': {
      const profile = getProfile()
      const settings = getSettings()
      const query =
        String(args.query ?? '').trim() ||
        settings.huntQuery ||
        profile.skills.slice(0, 5).join(' ') ||
        profile.experience[0]?.title ||
        ''
      const jobs = await huntJobs(query, settings.boardUrls)
      return { ok: true, data: { query, count: jobs.length, jobs: jobs.slice(0, 15) } }
    }
    case 'open_job': {
      const job = args.jobId ? getJob(String(args.jobId)) : null
      const url = job?.url || String(args.url ?? '')
      if (!url) return { ok: false, data: { error: 'No URL' } }
      try {
        const nav = await navigateApply(url)
        return { ok: true, data: nav }
      } catch {
        return {
          ok: true,
          data: { url, note: 'Open the Apply desk to load the page, then scan.' }
        }
      }
    }
    case 'scan_page': {
      try {
        const scan = await scanPage()
        if (scan.captcha) {
          return {
            ok: true,
            data: scan,
            needs_human: {
              kind: 'captcha',
              question: 'CAPTCHA detected on the application page. Solve it, then continue.'
            }
          }
        }
        if (scan.loginHints && scan.fields.length < 3) {
          return {
            ok: true,
            data: scan,
            needs_human: {
              kind: 'login',
              question: 'This page looks like a login wall. Sign in, then continue.'
            }
          }
        }
        return { ok: true, data: scan }
      } catch (err) {
        return { ok: false, data: { error: String(err) } }
      }
    }
    case 'map_fields': {
      const profile = getProfile()
      const job = args.jobId ? getJob(String(args.jobId)) : null
      const app = job ? getApplicationForJob(job.id) : null
      const fields = (args.fields as Parameters<typeof mapFormFields>[1]) ?? []
      const mappings = await mapFormFields(profile, fields, app?.coverLetter)
      if (job) upsertApplication({ jobId: job.id, status: 'filled', fieldMap: mappings })
      return { ok: true, data: mappings }
    }
    case 'fill_fields': {
      const job = getJob(String(args.jobId))
      const app = job ? getApplicationForJob(job.id) : null
      if (!app?.fieldMap?.length) return { ok: false, data: { error: 'No mapped fields. Run map_fields first.' } }
      const result = await fillMapped(app.fieldMap)
      upsertApplication({ jobId: job!.id, status: 'filled' })
      return { ok: true, data: result }
    }
    case 'draft_cover_letter': {
      const job = getJob(String(args.jobId))
      if (!job) return { ok: false, data: { error: 'Job not found' } }
      const profile = getProfile()
      const draft = await draftCoverLetter(profile, job.title, job.company, job.jdText)
      const warnings = inventedClaimCheck(draft.letter, profile)
      upsertApplication({ jobId: job.id, status: 'drafted', coverLetter: draft.letter })
      return { ok: true, data: { ...draft, warnings } }
    }
    case 'score_match':
    case 'flag_ai_filter': {
      const job = getJob(String(args.jobId))
      if (!job) return { ok: false, data: { error: 'Job not found' } }
      const updated = await matchAndFlagJob(job)
      return { ok: true, data: updated }
    }
    case 'queue_submit': {
      const job = getJob(String(args.jobId))
      return {
        ok: true,
        data: { queued: true, jobId: job?.id, url: applyUrl() || job?.url },
        needs_human: {
          kind: 'confirm_submit',
          question: `Confirm submit for ${job?.title ?? 'this role'} at ${job?.company ?? 'this company'}? This will click the page submit button.`,
          context: { jobId: job?.id }
        }
      }
    }
    case 'ask_user':
      return {
        ok: true,
        needs_human: {
          question: String(args.question ?? 'Need your input.'),
          kind: (args.kind as 'generic') || 'generic',
          context: args
        }
      }
    case 'copy_text':
      copyText(String(args.text ?? ''))
      return { ok: true, data: { copied: true } }
    default:
      return { ok: false, data: { error: `Unknown tool ${name}` } }
  }
}
