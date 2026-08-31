import type { AiFilterFlag } from './types'

const LIKELY_AI = [
  /hirevue/i,
  /pymetrics/i,
  /modern hire/i,
  /paradox/i,
  /\bolivia\b/i,
  /eightfold/i,
  /phenom people/i,
  /beamery/i,
  /seekout/i,
  /workday ai/i,
  /ai[- ]powered (recruit|screen|sourc)/i,
  /automated (video )?interview/i,
  /automated screening/i,
  /ai screening/i,
  /machine learning screening/i,
  /applicant tracking.*ai/i,
  /codility/i,
  /hackerrank/i,
  /pymetrics/i
]

const HUMAN_HINTS = [
  /greenhouse/i,
  /lever\.co/i,
  /email the hiring manager/i,
  /we read every application/i,
  /human review/i
]

export function heuristicAiFilter(text: string, url = ''): { flag: AiFilterFlag; reason: string } {
  const hay = `${url}\n${text}`
  const hits = LIKELY_AI.filter((re) => re.test(hay)).map((re) => re.source.replace(/\\/g, ''))
  if (hits.length) {
    return { flag: 'likely_ai', reason: `Matched screening signals: ${hits.slice(0, 4).join(', ')}` }
  }
  if (HUMAN_HINTS.some((re) => re.test(hay))) {
    return { flag: 'human_likely', reason: 'Board/language suggests human review; no AI-screen vendor detected.' }
  }
  return { flag: 'unknown', reason: 'Not enough signal to classify screening process.' }
}

export function flagLabel(flag: AiFilterFlag): string {
  switch (flag) {
    case 'likely_ai':
      return 'Likely AI screen'
    case 'human_likely':
      return 'Human review likely'
    default:
      return 'Unknown screen'
  }
}
