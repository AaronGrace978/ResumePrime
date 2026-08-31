import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import initSqlJs, { type Database } from 'sql.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  jd_text TEXT NOT NULL DEFAULT '',
  match_score REAL,
  match_rationale TEXT,
  ai_filter_flag TEXT NOT NULL DEFAULT 'unknown',
  ai_filter_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  cover_letter TEXT,
  field_map TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS secrets (
  key TEXT PRIMARY KEY,
  value BLOB NOT NULL
);
`

let db: Database | null = null
let dbPath = ''

function persist(): void {
  if (!db || !dbPath) return
  writeFileSync(dbPath, Buffer.from(db.export()))
}

export async function initDb(): Promise<void> {
  if (db) return
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  dbPath = join(dir, 'resumeprime.db')

  const require = createRequire(__filename)
  const distDir = dirname(require.resolve('sql.js'))
  const SQL = await initSqlJs({
    locateFile: (file) => join(distDir, file)
  })

  try {
    const file = readFileSync(dbPath)
    db = new SQL.Database(file)
  } catch {
    db = new SQL.Database()
  }
  db.run(SCHEMA)
  persist()
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function run(sql: string, params: unknown[] = []): void {
  getDb().run(sql, params as never[])
  persist()
}

export function get<T>(sql: string, params: unknown[] = []): T | undefined {
  const stmt = getDb().prepare(sql)
  if (params.length) stmt.bind(params as never[])
  const row = stmt.step() ? (stmt.getAsObject() as T) : undefined
  stmt.free()
  return row
}

export function all<T>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql)
  if (params.length) stmt.bind(params as never[])
  const rows: T[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as T)
  stmt.free()
  return rows
}
