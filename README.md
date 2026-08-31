# ResumePrime

Electron desktop agent that scans your resume, hunts matching jobs, drafts cover letters in your own wording, fills ATS forms, and flags companies that likely use AI to filter applications.

Submit is never automatic. You confirm.

## Stack

- Electron + React + Vite + Tailwind
- SQLite (`better-sqlite3`) in the main process
- LLM: **Ollama Cloud** (default), OpenAI, Anthropic
- Agent harness with tools: hunt, scan, map, fill, draft, score, AI-filter, queue submit

## Run

```bash
npm install
npm run dev
```

Windows note: SQLite runs via `sql.js` (no native build tools required).

## First use

1. **Settings** — paste an Ollama Cloud API key (`OLLAMA_API_KEY` from ollama.com). Optionally add OpenAI / Anthropic keys.
2. Pick task models. Defaults: `glm-5.3` (agent), `deepseek-v4-flash` (parse/match), `kimi-k3` (cover letters).
3. **Resume** — import PDF / DOCX / TXT. Edit the vault.
4. **Jobs** — Hunt by skills, or paste a Greenhouse / Lever board URL.
5. **Apply** — open the posting, Scan + map, Fill. Confirm submit from the agent panel when queued.

Keyboard: `Ctrl/Cmd` + `1–5` switches Resume / Jobs / Apply / Agent / Settings.
