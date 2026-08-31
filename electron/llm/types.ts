export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  toolCallId?: string
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  tools?: ToolDef[]
  json?: boolean
  think?: boolean
}

export interface ChatResult {
  content: string
  thinking?: string
  toolCalls: ToolCall[]
  raw?: unknown
}

export interface LLMProvider {
  id: string
  chat(req: ChatRequest): Promise<ChatResult>
  listModels(): Promise<string[]>
}

export function parseJsonLoose<T>(text: string): T {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1].trim() : trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  const slice = start >= 0 && end > start ? body.slice(start, end + 1) : body
  return JSON.parse(slice) as T
}
