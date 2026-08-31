import { extractResumeText } from './extract'
import { parseResumeText } from '../llm/harness'
import { getProfile, saveProfile } from '../db/store'

export async function importAndParseResume(filePath: string) {
  const rawText = await extractResumeText(filePath)
  const existing = getProfile()
  try {
    const parsed = await parseResumeText(rawText)
    return saveProfile({ ...parsed, rawText })
  } catch {
    return saveProfile({ ...existing, rawText })
  }
}
