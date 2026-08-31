import { useEffect, useState } from 'react'
import type { AppSettings, ProviderId, TaskKind } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'
import { Button } from '../components/Button'
import { prime } from '../lib/prime'

const TASKS: { id: TaskKind; label: string }[] = [
  { id: 'agent', label: 'Agent loop' },
  { id: 'resume.parse', label: 'Resume parse' },
  { id: 'cover.draft', label: 'Cover letter' },
  { id: 'job.match', label: 'Job match' },
  { id: 'form.map', label: 'Form map' },
  { id: 'aiFilter.detect', label: 'AI filter' }
]

export function SettingsView() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [secrets, setSecrets] = useState({ ollama: false, openai: false, anthropic: false })
  const [keys, setKeys] = useState({ ollama: '', openai: '', anthropic: '' })
  const [models, setModels] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [boards, setBoards] = useState('')

  async function reload() {
    const data = await prime.settings.get()
    setSettings(data.settings)
    setSecrets(data.secrets)
    setBoards((data.settings.boardUrls ?? []).join('\n'))
  }

  useEffect(() => {
    void reload()
  }, [])

  useEffect(() => {
    void prime.settings
      .listModels(settings.provider)
      .then(setModels)
      .catch(() => setModels([]))
  }, [settings.provider])

  return (
    <div className="h-full overflow-auto px-8 py-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Settings</p>
      <h2 className="text-2xl font-bold text-ink">Providers & harnesses</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Ollama Cloud is default. OpenAI and Anthropic use the same task harnesses. Keys stay in OS-encrypted storage.
      </p>

      <section className="mt-6 max-w-2xl rounded-2xl border border-line bg-white p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Active provider</p>
        <div className="mt-3 flex gap-2">
          {(['ollama', 'openai', 'anthropic'] as ProviderId[]).map((id) => (
            <button
              key={id}
              onClick={() => setSettings({ ...settings, provider: id })}
              className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${
                settings.provider === id ? 'bg-teal text-white' : 'border border-line bg-canvas text-ink'
              }`}
            >
              {id === 'ollama' ? 'Ollama Cloud' : id}
            </button>
          ))}
        </div>

        {settings.provider === 'ollama' && (
          <label className="mt-4 block text-xs font-semibold uppercase text-muted">
            Ollama host
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink outline-none focus:border-teal"
              value={settings.ollamaHost}
              onChange={(e) => setSettings({ ...settings, ollamaHost: e.target.value })}
            />
          </label>
        )}
        {settings.provider === 'openai' && (
          <label className="mt-4 block text-xs font-semibold uppercase text-muted">
            OpenAI model
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink outline-none focus:border-teal"
              value={settings.openaiModel}
              onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
            />
          </label>
        )}
        {settings.provider === 'anthropic' && (
          <label className="mt-4 block text-xs font-semibold uppercase text-muted">
            Anthropic model
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink outline-none focus:border-teal"
              value={settings.anthropicModel}
              onChange={(e) => setSettings({ ...settings, anthropicModel: e.target.value })}
            />
          </label>
        )}
      </section>

      <section className="mt-4 max-w-2xl rounded-2xl border border-line bg-white p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">API keys</p>
        {(['ollama', 'openai', 'anthropic'] as const).map((name) => (
          <div key={name} className="mt-3">
            <label className="text-xs font-semibold capitalize text-ink">
              {name === 'ollama' ? 'Ollama Cloud' : name} {secrets[name] ? '· saved' : ''}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="password"
                className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
                placeholder={secrets[name] ? '••••••••  (leave blank to keep)' : 'Paste key'}
                value={keys[name]}
                onChange={(e) => setKeys({ ...keys, [name]: e.target.value })}
              />
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!keys[name].trim()) return
                  await prime.settings.saveKey(name, keys[name])
                  setKeys({ ...keys, [name]: '' })
                  await reload()
                  setNote(`${name} key saved.`)
                }}
              >
                Save
              </Button>
            </div>
          </div>
        ))}
      </section>

      {settings.provider === 'ollama' && (
        <section className="mt-4 max-w-2xl rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ollama Cloud task models</p>
          {TASKS.map((t) => (
            <label key={t.id} className="mt-3 block text-xs font-semibold text-ink">
              {t.label}
              <input
                list="ollama-models"
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-medium outline-none focus:border-teal"
                value={settings.models[t.id]}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    models: { ...settings.models, [t.id]: e.target.value }
                  })
                }
              />
            </label>
          ))}
          <datalist id="ollama-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </section>
      )}

      <section className="mt-4 max-w-2xl rounded-2xl border border-line bg-white p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Hunt</p>
        <label className="mt-3 block text-xs font-semibold text-ink">
          Default hunt query
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
            value={settings.huntQuery}
            onChange={(e) => setSettings({ ...settings, huntQuery: e.target.value })}
            placeholder="e.g. senior product designer"
          />
        </label>
        <label className="mt-3 block text-xs font-semibold text-ink">
          Board URLs (Greenhouse / Lever, one per line)
          <textarea
            className="mt-1 h-28 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
            value={boards}
            onChange={(e) => setBoards(e.target.value)}
            placeholder="https://boards.greenhouse.io/stripe"
          />
        </label>
      </section>

      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={async () => {
            const next = {
              ...settings,
              boardUrls: boards
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
            }
            await prime.settings.save(next)
            setSettings(next)
            setNote('Settings saved.')
          }}
        >
          Save settings
        </Button>
        {note && <span className="text-sm text-teal-dark">{note}</span>}
      </div>
    </div>
  )
}
