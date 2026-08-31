import { useEffect, useState } from 'react'
import type { Application, Job, Profile } from '../../shared/types'
import { emptyProfile } from '../../shared/types'
import { Button } from '../components/Button'
import { prime } from '../lib/prime'

export function ResumeStudio({
  jobs,
  onProfile
}: {
  jobs: Job[]
  onProfile: (p: Profile) => void
}) {
  const [profile, setProfile] = useState<Profile>(emptyProfile())
  const [busy, setBusy] = useState('')
  const [jobId, setJobId] = useState('')
  const [letter, setLetter] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void prime.resume.get().then((p) => {
      setProfile(p)
      onProfile(p)
    })
    void prime.applications.list().then((apps: Application[]) => {
      const drafted = apps.find((a) => a.coverLetter)
      if (drafted) {
        setJobId(drafted.jobId)
        setLetter(drafted.coverLetter ?? '')
      }
    })
  }, [onProfile])

  async function persist(next: Profile) {
    setProfile(next)
    onProfile(next)
    await prime.resume.save(next)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-line px-8 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Resume studio</p>
          <h2 className="text-2xl font-bold text-ink">Your words, structured</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={!!busy}
            onClick={async () => {
              setBusy('import')
              setError('')
              try {
                const p = await prime.resume.import()
                setProfile(p)
                onProfile(p)
              } catch (e) {
                setError(String(e))
              } finally {
                setBusy('')
              }
            }}
          >
            {busy === 'import' ? 'Scanning…' : 'Import resume'}
          </Button>
          <Button
            disabled={!!busy}
            onClick={async () => {
              setBusy('save')
              await persist(profile)
              setBusy('')
            }}
          >
            Save vault
          </Button>
        </div>
      </header>

      {error && <p className="mx-8 mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-0 overflow-hidden">
        <section className="overflow-auto border-r border-line px-8 py-6">
          <Field label="Full name" value={profile.fullName} onChange={(fullName) => setProfile({ ...profile, fullName })} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Email" value={profile.email} onChange={(email) => setProfile({ ...profile, email })} />
            <Field label="Phone" value={profile.phone} onChange={(phone) => setProfile({ ...profile, phone })} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Location" value={profile.location} onChange={(location) => setProfile({ ...profile, location })} />
            <Field label="LinkedIn" value={profile.linkedin} onChange={(linkedin) => setProfile({ ...profile, linkedin })} />
          </div>
          <Field
            className="mt-3"
            label="Website"
            value={profile.website}
            onChange={(website) => setProfile({ ...profile, website })}
          />
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted">
            Summary
            <textarea
              className="mt-1 h-24 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              value={profile.summary}
              onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
            />
          </label>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted">
            Skills (comma separated)
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              value={profile.skills.join(', ')}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                })
              }
            />
          </label>
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Experience bullets</p>
            <ul className="mt-2 space-y-3">
              {profile.experience.map((exp, i) => (
                <li key={`${exp.company}-${i}`} className="rounded-xl border border-line bg-white p-3">
                  <p className="text-sm font-semibold">
                    {exp.title} · {exp.company}
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-sm text-muted">
                    {exp.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </li>
              ))}
              {!profile.experience.length && (
                <p className="text-sm text-muted">Import a resume to pull experience in your phrasing.</p>
              )}
            </ul>
          </div>
        </section>

        <section className="flex flex-col overflow-hidden bg-white px-8 py-6">
          <div className="flex items-end justify-between gap-3">
            <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Cover letter for
              <select
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink outline-none focus:border-teal"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              >
                <option value="">Select a job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} — {j.company}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!jobId || !!busy}
              onClick={async () => {
                setBusy('cover')
                setError('')
                try {
                  const result = await prime.resume.draftCover(jobId)
                  setLetter(result.letter)
                  setWarnings(result.warnings ?? [])
                } catch (e) {
                  setError(String(e))
                } finally {
                  setBusy('')
                }
              }}
            >
              {busy === 'cover' ? 'Drafting…' : 'Draft in my words'}
            </Button>
          </div>
          {warnings.length > 0 && (
            <ul className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-warn">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <textarea
            className="letter-body mt-4 min-h-0 flex-1 rounded-xl border border-line px-4 py-3 text-ink outline-none focus:border-teal"
            placeholder="Cover letter appears here. Only claims from your resume."
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
          />
          <div className="mt-3 flex justify-end">
            <Button
              variant="secondary"
              disabled={!jobId || !letter}
              onClick={() => prime.applications.saveCover(jobId, letter)}
            >
              Save letter
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  className = ''
}: {
  label: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <label className={`block text-xs font-semibold uppercase tracking-wide text-muted ${className}`}>
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink outline-none focus:border-teal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
