import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  packaged: true,
  handlers: new Map<string, (...args: any[]) => any>(),
  events: new Map<string, (...args: any[]) => void>(),
  updater: {
    autoDownload: true, autoInstallOnAppQuit: false, allowDowngrade: true,
    on: vi.fn(), checkForUpdates: vi.fn(), downloadUpdate: vi.fn(), quitAndInstall: vi.fn(),
  },
}))
vi.mock('electron', () => ({
  app: { get isPackaged() { return mock.packaged }, getVersion: () => '1.1.0' },
  ipcMain: { handle: (name: string, handler: (...args: any[]) => any) => mock.handlers.set(name, handler) },
}))
vi.mock('electron-updater', () => ({ default: { autoUpdater: mock.updater } }))

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers()
  mock.packaged = true; mock.handlers.clear(); mock.events.clear()
  mock.updater.on.mockImplementation((event, handler) => mock.events.set(event, handler))
  mock.updater.checkForUpdates.mockResolvedValue({ isUpdateAvailable: false, updateInfo: { version: '1.0.0' } })
  mock.updater.downloadUpdate.mockResolvedValue([])
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('GitHub update lifecycle', () => {
  it('does not offer an older release as an update', async () => {
    const { initAutoUpdater } = await import('./updater')
    initAutoUpdater(vi.fn())
    expect(await mock.handlers.get('updater:check')!()).toMatchObject({ ok: true, updateAvailable: false })
  })

  it('replays an available update after a renderer reload', async () => {
    const { initAutoUpdater } = await import('./updater')
    initAutoUpdater(vi.fn())
    mock.events.get('update-available')!({ version: '1.2.0', releaseNotes: '<b>Fixes</b>' })
    expect(await mock.handlers.get('updater:getState')!()).toEqual({ type: 'available', version: '1.2.0', notes: 'Fixes' })
  })

  it('refuses to install before a download completes', async () => {
    const { initAutoUpdater } = await import('./updater')
    initAutoUpdater(vi.fn())
    expect(await mock.handlers.get('updater:install')!()).toMatchObject({ ok: false })
    await vi.runOnlyPendingTimersAsync()
    expect(mock.updater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('preserves a downloaded update during later scheduled checks', async () => {
    const { initAutoUpdater } = await import('./updater')
    initAutoUpdater(vi.fn())
    mock.events.get('update-downloaded')!({ version: '1.2.0' })
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
    expect(mock.updater.checkForUpdates).not.toHaveBeenCalled()
    expect(await mock.handlers.get('updater:getState')!()).toMatchObject({ type: 'downloaded', version: '1.2.0' })
    expect(await mock.handlers.get('updater:install')!()).toEqual({ ok: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(mock.updater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })

  it('requires an available update before starting a download', async () => {
    const { initAutoUpdater } = await import('./updater')
    initAutoUpdater(vi.fn())
    expect(await mock.handlers.get('updater:download')!()).toMatchObject({ ok: false })
    expect(mock.updater.downloadUpdate).not.toHaveBeenCalled()
  })

  it('keeps checks and downloads disabled in development', async () => {
    mock.packaged = false
    const { initAutoUpdater } = await import('./updater')
    initAutoUpdater(vi.fn())
    expect(await mock.handlers.get('updater:check')!()).toMatchObject({ ok: false, disabled: true })
    expect(mock.updater.on).not.toHaveBeenCalled()
  })

  it('registers handlers only once', async () => {
    const { initAutoUpdater } = await import('./updater')
    const send = vi.fn()
    initAutoUpdater(send); initAutoUpdater(send)
    expect(mock.updater.on).toHaveBeenCalledTimes(6)
    expect(mock.updater.autoDownload).toBe(false)
    expect(mock.updater.autoInstallOnAppQuit).toBe(true)
    expect(mock.updater.allowDowngrade).toBe(false)
  })
})
