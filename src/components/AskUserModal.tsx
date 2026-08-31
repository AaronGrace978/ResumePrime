import { useState } from 'react'
import type { HumanAsk } from '../../shared/types'
import { prime } from '../lib/prime'
import { Button } from './Button'

export function AskUserModal({ ask, onClose }: { ask: HumanAsk; onClose: () => void }) {
  const [answer, setAnswer] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-dark">Needs you</p>
        <h2 className="mt-1 text-xl font-semibold text-ink">{ask.question}</h2>
        {ask.kind === 'confirm_submit' ? (
          <div className="mt-5 flex gap-2">
            <Button
              className="flex-1"
              onClick={async () => {
                await prime.agent.confirmSubmit(ask.runId, true)
                onClose()
              }}
            >
              Submit now
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={async () => {
                await prime.agent.confirmSubmit(ask.runId, false)
                onClose()
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              await prime.agent.answer(ask.runId, answer || 'Continue')
              onClose()
            }}
          >
            <textarea
              className="h-24 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type a reply, or continue after you finish in the page."
            />
            <Button type="submit" className="w-full">
              Continue agent
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
