import OpenAI from 'openai'
import { getSecret } from '../secrets'
import type { ChatRequest, ChatResult, LLMProvider, ToolCall } from './types'

export class OpenAIProvider implements LLMProvider {
  id = 'openai'

  private client(): OpenAI {
    const key = getSecret('openai')
    if (!key) throw new Error('OpenAI API key is not set. Add it in Settings.')
    return new OpenAI({ apiKey: key })
  }

  async listModels(): Promise<string[]> {
    try {
      const list = await this.client().models.list()
      return list.data.map((m) => m.id).sort()
    } catch {
      return ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'o3', 'o4-mini']
    }
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

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = req.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId ?? m.name ?? 'tool',
          content: m.content
        }
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((c) => ({
            id: c.id,
            type: 'function' as const,
            function: { name: c.name, arguments: JSON.stringify(c.arguments) }
          }))
        }
      }
      return { role: m.role, content: m.content }
    })

    const response = await this.client().chat.completions.create({
      model: req.model,
      messages,
      tools: tools?.length ? tools : undefined,
      response_format: req.json ? { type: 'json_object' } : undefined
    })

    const msg = response.choices[0]?.message
    const toolCalls: ToolCall[] = (msg?.tool_calls ?? [])
      .filter((c) => c.type === 'function')
      .map((c) => ({
        id: c.id,
        name: c.function.name,
        arguments: safeParse(c.function.arguments)
      }))

    return {
      content: msg?.content ?? '',
      toolCalls,
      raw: response
    }
  }
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { raw }
  }
}
