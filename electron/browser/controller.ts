import { BrowserWindow, WebContentsView, clipboard } from 'electron'
import type { FieldMapping, FormField } from '../../shared/types'
import { FILL_FIELDS_SCRIPT, SCAN_PAGE_SCRIPT, SUBMIT_SCRIPT } from './scripts'

let host: BrowserWindow | null = null
let view: WebContentsView | null = null
let visible = false

export function attachBrowserHost(win: BrowserWindow): void {
  host = win
}

export function showApplyView(bounds: { x: number; y: number; width: number; height: number }): void {
  if (!host) return
  if (!view) {
    view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true
      }
    })
    try {
      view.setBorderRadius(12)
    } catch {
      /* older electron */
    }
    host.contentView.addChildView(view)
    view.webContents.setWindowOpenHandler(({ url }) => {
      void view?.webContents.loadURL(url)
      return { action: 'deny' }
    })
  }
  visible = true
  view.setBounds({
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.max(100, Math.round(bounds.width)),
    height: Math.max(100, Math.round(bounds.height))
  })
}

export function hideApplyView(): void {
  if (!host || !view) return
  visible = false
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
}

export function isApplyVisible(): boolean {
  return visible
}

export async function navigateApply(url: string): Promise<{ url: string; title: string }> {
  if (!view) throw new Error('Apply browser is not open')
  const target = normalizeUrl(url)
  await view.webContents.loadURL(target)
  return { url: view.webContents.getURL(), title: view.webContents.getTitle() }
}

export function applyUrl(): string {
  return view?.webContents.getURL() ?? ''
}

export async function scanPage(): Promise<{
  url: string
  title: string
  fields: FormField[]
  captcha: boolean
  loginHints: boolean
  submitText: string | null
}> {
  if (!view) throw new Error('Apply browser is not open')
  const result = await view.webContents.executeJavaScript(SCAN_PAGE_SCRIPT, true)
  return result
}

export async function fillMapped(mappings: FieldMapping[]): Promise<unknown> {
  if (!view) throw new Error('Apply browser is not open')
  const payload = mappings
    .filter((m) => m.value)
    .map((m) => ({ selector: m.selector, value: m.value }))
  return view.webContents.executeJavaScript(`(${FILL_FIELDS_SCRIPT})(${JSON.stringify(payload)})`, true)
}

export async function confirmSubmit(): Promise<{ ok: boolean; reason?: string; text?: string }> {
  if (!view) throw new Error('Apply browser is not open')
  return view.webContents.executeJavaScript(SUBMIT_SCRIPT, true)
}

export function copyText(text: string): void {
  clipboard.writeText(text)
}

export function goBack(): void {
  view?.webContents.goBack()
}

export function goForward(): void {
  view?.webContents.goForward()
}

export function reload(): void {
  view?.webContents.reload()
}

function normalizeUrl(url: string): string {
  const t = url.trim()
  if (!t) return 'about:blank'
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}
