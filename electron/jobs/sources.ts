import { heuristicAiFilter } from '../../shared/ai-filter'
import type { Job } from '../../shared/types'
import { upsertJob } from '../db/store'

export interface DiscoveredJob {
  source: string
  url: string
  company: string
  title: string
  location: string
  jdText: string
}

export async function ingestUrl(url: string): Promise<Job> {
  const html = await fetchText(url)
  const discovered = parseGenericJobPage(url, html)
  return persist(discovered)
}

export async function ingestBoard(boardUrl: string): Promise<Job[]> {
  const trimmed = boardUrl.trim()
  if (!trimmed) return []

  const greenhouse = trimmed.match(/boards-api\.greenhouse\.io\/v1\/boards\/([^/]+)/i)
    ?? trimmed.match(/job-boards\.greenhouse\.io\/([^/?#]+)/i)
    ?? trimmed.match(/boards\.greenhouse\.io\/([^/?#]+)/i)
  if (greenhouse) {
    return persistMany(await fetchGreenhouse(greenhouse[1]))
  }

  const lever = trimmed.match(/api\.lever\.co\/v0\/postings\/([^/?#]+)/i)
    ?? trimmed.match(/jobs\.lever\.co\/([^/?#]+)/i)
  if (lever) {
    return persistMany(await fetchLever(lever[1]))
  }

  if (/remotive\.com/i.test(trimmed)) {
    const q = new URL(trimmed).searchParams.get('search') ?? ''
    return persistMany(await fetchRemotive(q))
  }

  return [await ingestUrl(trimmed)]
}

export async function huntJobs(query: string, boardUrls: string[]): Promise<Job[]> {
  const found: DiscoveredJob[] = []
  const q = query.trim()
  if (q) {
    try {
      found.push(...(await fetchRemotive(q)))
    } catch {
      /* keep going */
    }
    try {
      found.push(...(await fetchArbeitnow(q)))
    } catch {
      /* keep going */
    }
  }
  for (const board of boardUrls) {
    try {
      const jobs = await ingestBoard(board)
      found.push(
        ...jobs.map((j) => ({
          source: j.source,
          url: j.url,
          company: j.company,
          title: j.title,
          location: j.location,
          jdText: j.jdText
        }))
      )
    } catch {
      /* skip bad boards */
    }
  }
  const unique = dedupe(found)
  return persistMany(unique)
}

async function fetchGreenhouse(token: string): Promise<DiscoveredJob[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`)
  if (!res.ok) throw new Error(`Greenhouse ${token}: ${res.status}`)
  const data = (await res.json()) as {
    jobs?: {
      id: number
      title: string
      absolute_url: string
      location?: { name?: string }
      content?: string
    }[]
  }
  return (data.jobs ?? []).map((j) => ({
    source: `greenhouse:${token}`,
    url: j.absolute_url,
    company: token,
    title: j.title,
    location: j.location?.name ?? '',
    jdText: stripHtml(j.content ?? '')
  }))
}

async function fetchLever(company: string): Promise<DiscoveredJob[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`)
  if (!res.ok) throw new Error(`Lever ${company}: ${res.status}`)
  const data = (await res.json()) as {
    id: string
    text: string
    hostedUrl: string
    categories?: { location?: string }
    descriptionPlain?: string
    description?: string
  }[]
  return data.map((j) => ({
    source: `lever:${company}`,
    url: j.hostedUrl,
    company,
    title: j.text,
    location: j.categories?.location ?? '',
    jdText: j.descriptionPlain || stripHtml(j.description ?? '')
  }))
}

async function fetchRemotive(search: string): Promise<DiscoveredJob[]> {
  const url = new URL('https://remotive.com/api/remote-jobs')
  if (search) url.searchParams.set('search', search)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Remotive: ${res.status}`)
  const data = (await res.json()) as {
    jobs?: {
      url: string
      company_name: string
      title: string
      candidate_required_location?: string
      description?: string
    }[]
  }
  return (data.jobs ?? []).slice(0, 40).map((j) => ({
    source: 'remotive',
    url: j.url,
    company: j.company_name,
    title: j.title,
    location: j.candidate_required_location ?? 'Remote',
    jdText: stripHtml(j.description ?? '')
  }))
}

async function fetchArbeitnow(search: string): Promise<DiscoveredJob[]> {
  const res = await fetch('https://www.arbeitnow.com/api/job-board-api')
  if (!res.ok) throw new Error(`Arbeitnow: ${res.status}`)
  const data = (await res.json()) as {
    data?: { url: string; company_name: string; title: string; location?: string; description?: string }[]
  }
  const q = search.toLowerCase()
  return (data.data ?? [])
    .filter((j) => {
      const hay = `${j.title} ${j.company_name} ${j.description ?? ''}`.toLowerCase()
      return q.split(/\s+/).some((w) => w.length > 2 && hay.includes(w))
    })
    .slice(0, 30)
    .map((j) => ({
      source: 'arbeitnow',
      url: j.url,
      company: j.company_name,
      title: j.title,
      location: j.location ?? '',
      jdText: stripHtml(j.description ?? '')
    }))
}

function parseGenericJobPage(url: string, html: string): DiscoveredJob {
  const title =
    pickMeta(html, 'og:title') ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
    'Untitled role'
  const company =
    pickMeta(html, 'og:site_name') ||
    new URL(url).hostname.replace(/^www\./, '')
  const desc = pickMeta(html, 'og:description') || stripHtml(html).slice(0, 8000)
  return {
    source: 'url',
    url,
    company,
    title: decode(title),
    location: '',
    jdText: decode(desc)
  }
}

function persist(job: DiscoveredJob): Job {
  const heuristic = heuristicAiFilter(`${job.company} ${job.title}\n${job.jdText}`, job.url)
  return upsertJob({
    source: job.source,
    url: job.url,
    company: job.company,
    title: job.title,
    location: job.location,
    jdText: job.jdText,
    matchScore: null,
    matchRationale: null,
    aiFilterFlag: heuristic.flag,
    aiFilterReason: heuristic.reason
  })
}

function persistMany(jobs: DiscoveredJob[]): Job[] {
  return jobs.map(persist)
}

function dedupe(jobs: DiscoveredJob[]): DiscoveredJob[] {
  const seen = new Set<string>()
  const out: DiscoveredJob[] = []
  for (const j of jobs) {
    if (seen.has(j.url)) continue
    seen.add(j.url)
    out.push(j)
  }
  return out
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'ResumePrime/0.1' } })
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`)
  return res.text()
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickMeta(html: string, prop: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    'i'
  )
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    'i'
  )
  return decode(html.match(re)?.[1] || html.match(re2)?.[1] || '')
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
