import { BrowserWindow } from 'electron'
import { AGENT_SYSTEM } from '../../shared/prompts'
import type { AgentEvent, HumanAsk } from '../../shared/types'
import { confirmSubmit } from '../browser/controller'
import { insertEvent, insertRun, updateRun } from '../db/store'
import { chat, modelFor } from '../llm/registry'
import type { ChatMessage } from '../llm/types'
import { AGENT_TOOLS, executeTool, type ToolHandlerResult } from './tools'

const MAX_STEPS = 14
const pendingAsks = new Map<
  string,
  { resolve: (answer: string) => void; reject: (err: Error) => void }
>()
const cancelled = new Set<string>()

let mainWindow: BrowserWindow | null = null

export function setAgentWindow(win: BrowserWindow): void {
  mainWindow = win
}

function emit(event: AgentEvent): void {
  mainWindow?.webContents.send('agent:event', event)
}

function push(
  runId: string,
  type: AgentEvent['type'],
  payload: Record<string, unknown>
): AgentEvent {
  const event = insertEvent({ runId, type, payload })
  emit(event)
  return event
}

export async function startAgentRun(goal: string, kind = 'agent'): Promise<string> {
  const run = insertRun(kind, goal)
  void loop(run.id, goal)
  return run.id
}

export function cancelRun(runId: string): void {
  cancelled.add(runId)
  const waiter = pendingAsks.get(runId)
  if (waiter) {
    pendingAsks.delete(runId)
    waiter.reject(new Error('cancelled'))
  }
}

export function answerAsk(runId: string, answer: string): void {
  const waiter = pendingAsks.get(runId)
  if (!waiter) return
  pendingAsks.delete(runId)
  waiter.resolve(answer)
}

export async function confirmQueuedSubmit(runId: string, confirmed: boolean): Promise<unknown> {
  if (!confirmed) {
    answerAsk(runId, 'User declined submit.')
    return { ok: false, declined: true }
  }
  try {
    const result = await confirmSubmit()
    answerAsk(runId, `User confirmed submit. Result: ${JSON.stringify(result)}`)
    return result
  } catch (err) {
    answerAsk(runId, `Submit failed: ${String(err)}`)
    throw err
  }
}

async function waitForHuman(runId: string, ask: HumanAsk): Promise<string> {
  push(runId, 'needs_human', { ...ask })
  updateRun(runId, { status: 'needs_human' })
  return new Promise((resolve, reject) => {
    pendingAsks.set(runId, { resolve, reject })
  })
}

async function loop(runId: string, goal: string): Promise<void> {
  push(runId, 'run_start', { goal })
  const messages: ChatMessage[] = [
    { role: 'system', content: AGENT_SYSTEM },
    { role: 'user', content: goal }
  ]

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      if (cancelled.has(runId)) {
        updateRun(runId, { status: 'cancelled' })
        push(runId, 'done', { status: 'cancelled' })
        return
      }

      const result = await chat({
        model: modelFor('agent'),
        think: true,
        tools: AGENT_TOOLS,
        messages
      })

      if (result.thinking) {
        push(runId, 'thought', { text: result.thinking.slice(0, 2000) })
      }

      if (!result.toolCalls.length) {
        const output = result.content || 'Done.'
        updateRun(runId, { status: 'done', output })
        push(runId, 'done', { status: 'done', output })
        return
      }

      messages.push({
        role: 'assistant',
        content: result.content,
        toolCalls: result.toolCalls
      })

      for (const call of result.toolCalls) {
        push(runId, 'tool_call', { name: call.name, arguments: call.arguments })
        push(runId, 'status', { text: statusFor(call.name, call.arguments) })

        let toolResult: ToolHandlerResult
        try {
          toolResult = await executeTool(call.name, call.arguments)
        } catch (err) {
          toolResult = { ok: false, data: { error: String(err) } }
        }

        push(runId, 'tool_result', { name: call.name, result: summarize(toolResult) })

        if (toolResult.needs_human) {
          const answer = await waitForHuman(runId, {
            runId,
            question: toolResult.needs_human.question,
            kind: toolResult.needs_human.kind,
            context: toolResult.needs_human.context
          })
          updateRun(runId, { status: 'running' })
          toolResult = {
            ...toolResult,
            data: { ...(typeof toolResult.data === 'object' ? toolResult.data : {}), userAnswer: answer }
          }
        }

        messages.push({
          role: 'tool',
          name: call.name,
          toolCallId: call.id,
          content: JSON.stringify(toolResult)
        })
      }
    }

    updateRun(runId, { status: 'done', output: 'Reached step limit.' })
    push(runId, 'done', { status: 'done', output: 'Reached step limit.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    updateRun(runId, { status: 'error', output: message })
    push(runId, 'error', { message })
  }
}

function statusFor(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'read_profile':
      return 'Reading your profile…'
    case 'search_jobs':
      return `Hunting jobs${args.query ? ` for “${args.query}”` : ''}…`
    case 'open_job':
      return 'Opening application page…'
    case 'scan_page':
      return 'Scanning page…'
    case 'map_fields':
      return 'Mapping form fields to your profile…'
    case 'fill_fields':
      return 'Filling the form…'
    case 'draft_cover_letter':
      return 'Drafting cover letter in your words…'
    case 'score_match':
      return 'Scoring skill fit…'
    case 'flag_ai_filter':
      return 'Checking for AI application filters…'
    case 'queue_submit':
      return 'Queued submit — waiting for your confirm.'
    case 'ask_user':
      return 'Needs you.'
    case 'copy_text':
      return 'Copied to clipboard.'
    default:
      return name
  }
}

function summarize(result: ToolHandlerResult): unknown {
  const data = result.data as { fields?: unknown[]; jobs?: unknown[]; count?: number; letter?: string } | undefined
  if (data?.fields) return { ok: result.ok, fieldCount: data.fields.length, needs_human: result.needs_human }
  if (data?.jobs) return { ok: result.ok, count: data.count ?? data.jobs.length }
  if (data?.letter) return { ok: result.ok, letterChars: data.letter.length }
  return { ok: result.ok, data: result.data, needs_human: result.needs_human }
}
