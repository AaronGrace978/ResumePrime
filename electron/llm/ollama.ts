import { Ollama } from 'ollama'
import { getSecret } from '../secrets'
import { getSettings } from '../db/store'
import type { ChatRequest, ChatResult, LLMProvider, ToolCall } from './types'

export class OllamaCloudProvider implements LLMProvider {
  id = 'ollama'

  private client(): Ollama {
    const settings = getSettings()
    const key = getSecret('ollama')
    const host = settings.ollamaHost || 'https://ollama.com'
    return new Ollama({
      host,
      headers: key ? { Authorization: `Bearer ${key}` } : undefined
    })
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await this.client().list()
      const names = res.models.map((m) => m.name).filter(Boolean)
      if (names.length) return names.sort()
    } catch {
      /* fall through to catalog */
    }
    return [
      'glm-5.3',
      'glm-5.3-flash',
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'kimi-k3',
      'kimi-k2.7-code',
      'minimax-m3',
      'minimax-m2.7',
      'gemma4:31b',
      'qwen3.5:397b',
      'gpt-oss:120b',
      'nemotron-3-ultra',
      'mistral-large-3'
    ]
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const tools = req.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))

    const messages = req.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          name: m.name
        }
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant' as const,
          content: m.content,
          tool_calls: m.toolCalls.map((c) => ({
            function: {
              name: c.name,
              arguments: c.arguments
            }
          }))
        }
      }
      return { role: m.role, content: m.content }
    })

    const response = await this.client().chat({
      model: req.model,
      messages,
      tools: tools?.length ? tools : undefined,
      stream: false,
      think: req.think ? true : undefined,
      format: req.json ? 'json' : undefined
    })

    const msg = response.message
    const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((c, i) => ({
      id: `call_${i}_${c.function?.name ?? 'tool'}`,
      name: c.function?.name ?? '',
      arguments: asArgs(c.function?.arguments)
    }))

    return {
      content: msg.content ?? '',
      thinking: typeof msg.thinking === 'string' ? msg.thinking : undefined,
      toolCalls,
      raw: response
    }
  }
}

function asArgs(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return { raw }
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return {}
}
