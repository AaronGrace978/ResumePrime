import Anthropic from '@anthropic-ai/sdk'
import { getSecret } from '../secrets'
import type { ChatMessage, ChatRequest, ChatResult, LLMProvider, ToolCall } from './types'

export class AnthropicProvider implements LLMProvider {
  id = 'anthropic'

  private client(): Anthropic {
    const key = getSecret('anthropic')
    if (!key) throw new Error('Anthropic API key is not set. Add it in Settings.')
    return new Anthropic({ apiKey: key })
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-haiku-4-5',
      'claude-opus-4-1',
      'claude-sonnet-4-0'
    ]
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const system = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')

    const tools = req.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema
    }))

    const messages = toAnthropicMessages(req.messages.filter((m) => m.role !== 'system'))

    const response = await this.client().messages.create({
      model: req.model,
      max_tokens: 8192,
      system: system || undefined,
      messages,
      tools: tools?.length ? tools : undefined
    })

    let content = ''
    const toolCalls: ToolCall[] = []
    for (const block of response.content) {
      if (block.type === 'text') content += block.text
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input ?? {}) as Record<string, unknown>
        })
      }
    }

    return { content, toolCalls, raw: response }
  }
}

function toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = []
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content })
      continue
    }
    if (m.role === 'assistant') {
      const blocks: Anthropic.ContentBlockParam[] = []
      if (m.content) blocks.push({ type: 'text', text: m.content })
      for (const c of m.toolCalls ?? []) {
        blocks.push({
          type: 'tool_use',
          id: c.id,
          name: c.name,
          input: c.arguments
        })
      }
      out.push({ role: 'assistant', content: blocks.length ? blocks : [{ type: 'text', text: m.content || '' }] })
      continue
    }
    if (m.role === 'tool') {
      const last = out[out.length - 1]
      const block: Anthropic.ToolResultBlockParam = {
        type: 'tool_result',
        tool_use_id: m.toolCallId ?? m.name ?? '',
        content: m.content
      }
      if (last?.role === 'user' && Array.isArray(last.content)) {
        ;(last.content as Anthropic.ContentBlockParam[]).push(block)
      } else {
        out.push({ role: 'user', content: [block] })
      }
    }
  }
  return out
}
