import type { ProviderId, TaskKind } from '../../shared/types'
import { getSettings } from '../db/store'
import { AnthropicProvider } from './anthropic'
import { OllamaCloudProvider } from './ollama'
import { OpenAIProvider } from './openai'
import type { ChatRequest, ChatResult, LLMProvider } from './types'
import { parseJsonLoose } from './types'
import { hasSecret } from '../secrets'

const ollama = new OllamaCloudProvider()
const openai = new OpenAIProvider()
const anthropic = new AnthropicProvider()

export function hasLlm(id?: ProviderId): boolean {
  const provider = id ?? getSettings().provider
  return hasSecret(provider)
}

export function getProvider(id?: ProviderId): LLMProvider {
  const provider = id ?? getSettings().provider
  if (provider === 'openai') return openai
  if (provider === 'anthropic') return anthropic
  return ollama
}

export function modelFor(task: TaskKind): string {
  const s = getSettings()
  if (s.provider === 'openai') return s.openaiModel
  if (s.provider === 'anthropic') return s.anthropicModel
  return s.models[task]
}

export async function runJsonTask<T>(opts: {
  task: TaskKind
  system: string
  user: string
}): Promise<T> {
  const provider = getProvider()
  const result = await provider.chat({
    model: modelFor(opts.task),
    json: true,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user }
    ]
  })
  return parseJsonLoose<T>(result.content)
}

export async function listModels(provider?: ProviderId): Promise<string[]> {
  return getProvider(provider).listModels()
}

export async function chat(req: ChatRequest): Promise<ChatResult> {
  return getProvider().chat(req)
}
