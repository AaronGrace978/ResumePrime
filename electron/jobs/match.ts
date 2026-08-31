import type { Job, Profile } from '../../shared/types'
import { getProfile, listJobs, upsertJob } from '../db/store'
import { detectAiFilter, scoreMatch } from '../llm/harness'
import { hasLlm } from '../llm/registry'

export async function matchAndFlagJob(job: Job, profile?: Profile): Promise<Job> {
  const p = profile ?? getProfile()
  let matchScore = job.matchScore
  let matchRationale = job.matchRationale
  if (hasLlm()) {
    try {
      const scored = await scoreMatch(p, job.title, job.company, job.jdText)
      matchScore = scored.score
      matchRationale = `${scored.rationale}${scored.gaps.length ? ` Gaps: ${scored.gaps.join(', ')}.` : ''}`
    } catch {
      matchScore = keywordScore(p, job)
      matchRationale = matchRationale ?? 'Keyword overlap (LLM unavailable).'
    }
  } else {
    matchScore = keywordScore(p, job)
    matchRationale = 'Keyword overlap — add an API key for LLM scoring.'
  }
  let aiFilterFlag = job.aiFilterFlag
  let aiFilterReason = job.aiFilterReason
  if (hasLlm()) {
    try {
      const ai = await detectAiFilter(job.company, job.title, job.jdText, job.url)
      aiFilterFlag = ai.flag
      aiFilterReason = ai.reason
    } catch {
      /* keep heuristic */
    }
  }
  return upsertJob({
    ...job,
    matchScore,
    matchRationale,
    aiFilterFlag,
    aiFilterReason
  })
}

export async function matchOpenJobs(limit = 20): Promise<Job[]> {
  const profile = getProfile()
  const pending = listJobs().filter((j) => j.matchScore == null).slice(0, limit)
  const out: Job[] = []
  for (const job of pending) {
    out.push(await matchAndFlagJob(job, profile))
  }
  return out
}

function keywordScore(profile: Profile, job: Job): number {
  const skills = profile.skills.map((s) => s.toLowerCase()).filter(Boolean)
  if (!skills.length) return 0
  const hay = `${job.title}\n${job.jdText}`.toLowerCase()
  const hits = skills.filter((s) => hay.includes(s)).length
  return Math.min(100, Math.round((hits / Math.max(6, skills.length)) * 100 + (hits > 0 ? 10 : 0)))
}
