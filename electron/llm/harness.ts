import {
  AI_FILTER_SYSTEM,
  COVER_DRAFT_SYSTEM,
  FORM_MAP_SYSTEM,
  JOB_MATCH_SYSTEM,
  RESUME_PARSE_SCHEMA,
  RESUME_PARSE_SYSTEM
} from '../../shared/prompts'
import { heuristicAiFilter } from '../../shared/ai-filter'
import type { AiFilterFlag, FieldMapping, FormField, Profile } from '../../shared/types'
import { emptyProfile } from '../../shared/types'
import { runJsonTask } from './registry'

export async function parseResumeText(rawText: string): Promise<Profile> {
  const parsed = await runJsonTask<Partial<Profile>>({
    task: 'resume.parse',
    system: RESUME_PARSE_SYSTEM,
    user: `Schema:\n${RESUME_PARSE_SCHEMA}\n\nResume text:\n${rawText.slice(0, 24000)}`
  })
  const base = emptyProfile()
  return {
    ...base,
    ...parsed,
    skills: parsed.skills ?? [],
    experience: parsed.experience ?? [],
    education: parsed.education ?? [],
    voiceSamples: parsed.voiceSamples ?? [],
    rawText,
    updatedAt: new Date().toISOString()
  }
}

export async function draftCoverLetter(profile: Profile, jobTitle: string, company: string, jd: string) {
  return runJsonTask<{ letter: string; usedPhrases: string[] }>({
    task: 'cover.draft',
    system: COVER_DRAFT_SYSTEM,
    user: JSON.stringify({
      profile: {
        fullName: profile.fullName,
        summary: profile.summary,
        skills: profile.skills,
        experience: profile.experience,
        voiceSamples: profile.voiceSamples
      },
      jobTitle,
      company,
      jobDescription: jd.slice(0, 12000)
    })
  })
}

export async function scoreMatch(profile: Profile, jobTitle: string, company: string, jd: string) {
  return runJsonTask<{
    score: number
    rationale: string
    matchedSkills: string[]
    gaps: string[]
  }>({
    task: 'job.match',
    system: JOB_MATCH_SYSTEM,
    user: JSON.stringify({
      skills: profile.skills,
      summary: profile.summary,
      experience: profile.experience.map((e) => ({
        title: e.title,
        company: e.company,
        bullets: e.bullets
      })),
      jobTitle,
      company,
      jobDescription: jd.slice(0, 10000)
    })
  })
}

export async function mapFormFields(profile: Profile, fields: FormField[], coverLetter?: string | null) {
  const mapped = await runJsonTask<{
    mappings: { fieldId: string; value: string; source: FieldMapping['source']; confidence: number }[]
  }>({
    task: 'form.map',
    system: FORM_MAP_SYSTEM,
    user: JSON.stringify({
      profile,
      coverLetter: coverLetter ?? '',
      fields
    })
  })
  const byId = new Map(mapped.mappings.map((m) => [m.fieldId, m]))
  return fields.map((f) => {
    const hit = byId.get(f.id)
    return {
      fieldId: f.id,
      label: f.label,
      selector: f.selector,
      type: f.type,
      required: f.required,
      value: hit?.value ?? '',
      source: hit?.source ?? 'empty',
      confidence: hit?.confidence ?? 0
    } satisfies FieldMapping
  })
}

export async function detectAiFilter(company: string, title: string, jd: string, url: string) {
  const heuristic = heuristicAiFilter(`${company} ${title}\n${jd}`, url)
  try {
    const llm = await runJsonTask<{ flag: AiFilterFlag; reason: string }>({
      task: 'aiFilter.detect',
      system: AI_FILTER_SYSTEM,
      user: JSON.stringify({ company, title, url, heuristic, jobDescription: jd.slice(0, 8000) })
    })
    return {
      flag: llm.flag ?? heuristic.flag,
      reason: llm.reason || heuristic.reason
    }
  } catch {
    return heuristic
  }
}

export function inventedClaimCheck(letter: string, profile: Profile): string[] {
  const hay = [
    profile.fullName,
    profile.summary,
    ...profile.skills,
    ...profile.voiceSamples,
    ...profile.experience.flatMap((e) => [e.company, e.title, ...e.bullets]),
    ...profile.education.flatMap((e) => [e.school, e.degree])
  ]
    .join('\n')
    .toLowerCase()

  const warnings: string[] = []
  const years = letter.match(/\d+\+?\s+years/gi) ?? []
  for (const y of years) {
    if (!hay.includes(y.toLowerCase()) && !profile.rawText.toLowerCase().includes(y.toLowerCase())) {
      warnings.push(`Letter mentions “${y.trim()}” which is not in the resume.`)
    }
  }
  return warnings
}
