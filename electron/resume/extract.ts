import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import mammoth from 'mammoth'

export async function extractResumeText(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.txt' || ext === '.md') {
    return readFile(filePath, 'utf8')
  }
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  }
  if (ext === '.pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const bytes = new Uint8Array(await readFile(filePath))
    const pdf = await getDocumentProxy(bytes)
    const { text } = await extractText(pdf, { mergePages: true })
    return Array.isArray(text) ? text.join('\n') : String(text)
  }
  throw new Error(`Unsupported resume format: ${ext || 'unknown'}`)
}
