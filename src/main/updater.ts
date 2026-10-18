/** GitHub Releases update lifecycle. Downloads start on demand; installation waits for restart/quit. */
import { app, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater
const FIRST_CHECK_MS = 15_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

type UpdateEvent =
  | { type: 'checking' | 'not-available' }
  | { type: 'available'; version: string; notes: string }
  | { type: 'progress'; version?: string; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string; version?: string }
type Result = { ok: boolean; disabled?: boolean; error?: string }
type Send = (channel: string, payload: unknown) => void
let sendEvent: Send = () => {}
let notify: (version: string, ready: boolean) => void = () => {}
let started = false
let ipcRegistered = false
let state: UpdateEvent | null = null
let checking: ReturnType<typeof autoUpdater.checkForUpdates> | null = null
let downloading: Promise<Result> | null = null
const version = () => state && 'version' in state ? state.version : undefined
function emit(event: UpdateEvent): void { state = event; sendEvent('updater:event', event) }

export function initAutoUpdater(send: Send, notification?: (version: string, ready: boolean) => void): void {
  sendEvent = send
  if (notification) notify = notification
  if (!ipcRegistered) { registerIpc(); ipcRegistered = true }
  if (!app.isPackaged || started) return
  started = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false
  autoUpdater.on('checking-for-update', () => { if (!state || state.type === 'not-available') emit({ type: 'checking' }) })
  autoUpdater.on('update-available', info => {
    const alreadyShown = version() === info.version
    emit({ type: 'available', version: info.version, notes: notes(info.releaseNotes) })
    if (!alreadyShown) notify(info.version, false)
  })
  autoUpdater.on('update-not-available', () => emit({ type: 'not-available' }))
  autoUpdater.on('download-progress', p => emit({ type: 'progress', version: version(), percent: Math.max(0, Math.min(100, Math.round(p.percent || 0))) }))
  autoUpdater.on('update-downloaded', info => {
    emit({ type: 'downloaded', version: info.version }); notify(info.version, true)
  })
  autoUpdater.on('error', err => emit({ type: 'error', message: cleanError(err), version: version() }))
  setTimeout(() => { void check() }, FIRST_CHECK_MS)
  setInterval(() => { void check() }, CHECK_INTERVAL_MS)
}

async function check() {
  if (!app.isPackaged) return { ok: false, disabled: true }
  if (downloading || state?.type === 'progress' || state?.type === 'downloaded') {
    return { ok: true, current: app.getVersion(), latest: version(), updateAvailable: true }
  }
  try {
    checking ??= autoUpdater.checkForUpdates()
    const result = await checking
    return { ok: true, current: app.getVersion(), latest: result?.updateInfo?.version, updateAvailable: result?.isUpdateAvailable === true }
  } catch (error) { return { ok: false, error: cleanError(error) } }
  finally { checking = null }
}

function registerIpc(): void {
  ipcMain.handle('updater:check', check)
  ipcMain.handle('updater:getState', () => state)
  ipcMain.handle('updater:download', () => {
    if (!app.isPackaged) return { ok: false, disabled: true }
    if (downloading) return downloading
    const targetVersion = version()
    if (!targetVersion || !['available', 'error'].includes(state?.type || '')) return { ok: false, error: 'Check for an available update first.' }
    emit({ type: 'progress', version: targetVersion, percent: 0 })
    downloading = (async (): Promise<Result> => {
      try { await autoUpdater.downloadUpdate(); return { ok: true } }
      catch (error) {
        emit({ type: 'error', message: cleanError(error), version: targetVersion })
        return { ok: false, error: cleanError(error) }
      } finally { downloading = null }
    })()
    return downloading
  })
  ipcMain.handle('updater:install', () => {
    if (!app.isPackaged) return { ok: false, disabled: true }
    if (state?.type !== 'downloaded') return { ok: false, error: 'Download the update before installing it.' }
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return { ok: true }
  })
  ipcMain.handle('updater:getVersion', () => app.getVersion())
}

function notes(value: string | { note: string | null }[] | null | undefined): string {
  const text = !value ? '' : typeof value === 'string' ? value : value.map(x => x?.note || '').filter(Boolean).join('\n\n')
  return text.replace(/<[^>]+>/g, '')
}
function cleanError(error: unknown): string {
  const message = (error as any)?.message || String(error)
  if (/net::|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|getaddrinfo/i.test(message)) return 'Could not reach the update server — check your connection.'
  if (/404|No published versions|latest\.yml/i.test(message)) return 'No published update found yet.'
  return message.split('\n')[0].slice(0, 200)
}
