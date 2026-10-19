/**
 * AIHub DJ — the DJ console from AIHub Browser as its own desktop app.
 *
 * The DJ itself (src/main/dj, src/renderer/src/components/dj) is copied from
 * AIHub Browser unchanged. This file is only the shell around it: one window,
 * the aihub-media:// scheme for local files, the DJ's IPC, YouTube search,
 * the AI DJ's language model and its facts store.
 */
import { app, BrowserWindow, ipcMain, Menu, Notification, screen, session, shell } from 'electron'
import path from 'path'
import { MIN_SIZE, fitBounds, loadBounds, saveBounds } from './windowState'
import { registerMediaScheme, registerMediaProtocol, registerDjIpc } from './dj/library'
import { parseSearchResults, searchUrl, type YouTubeVideo } from './youtubeSearch'
import { httpGet, withNetRetry } from './net'
import { registerAiIpc } from './ai'
import { registerFactsIpc, flushFacts } from './factsStore'
import { initAutoUpdater } from './updater'

app.setName('AIHub DJ')
// Windows groups the taskbar button and notifications by this id.
app.setAppUserModelId('com.mydigitalsolutions.aihub-dj')

// Must happen before 'ready'.
registerMediaScheme()

// The same honest Chrome identity AIHub Browser presents (derived from the
// engine's real version, so it never claims a newer Chrome than it is). The
// YouTube deck players are Chromium views; an "Electron/…" user agent is not
// what YouTube's embed expects to see.
const CHROME_MAJOR = process.versions.chrome.split('.')[0]
app.userAgentFallback = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`

if (!app.requestSingleInstanceLock()) app.quit()

let win: BrowserWindow | null = null

function createWindow(): void {
  // An ordinary window at the size and place it was last left (windowState.ts).
  const bounds = fitBounds(loadBounds(app.getPath('userData')), screen.getAllDisplays().map(d => d.workArea), screen.getPrimaryDisplay().workArea)
  win = new BrowserWindow({
    ...bounds, minWidth: MIN_SIZE.width, minHeight: MIN_SIZE.height,
    show: false,
    title: 'AIHub DJ',
    backgroundColor: '#0b0c0e',
    autoHideMenuBar: true,
    // Installed: Windows takes the icon from AIHub DJ.exe (electron-builder embeds build/icon.ico).
    ...(app.isPackaged ? {} : { icon: path.join(__dirname, '../../build/icon.ico') }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      // The decks keep playing (and the AI DJ keeps mixing) while the window is in the background.
      backgroundThrottling: false,
    },
  })
  win.once('ready-to-show', () => win?.show())
  // Remember the un-maximized size, so the next launch opens as a normal window.
  win.on('close', () => { if (win) saveBounds(app.getPath('userData'), win.getNormalBounds()) })
  // Links open in the user's browser, never inside the DJ window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win?.webContents.getURL()) { e.preventDefault(); if (/^https?:\/\//i.test(url)) void shell.openExternal(url) }
  })
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  win.on('closed', () => { win = null })
}

// ── YouTube search (same key-less search page read as AIHub Browser) ──
const TTL_MS = 15 * 60 * 1000
const ytCache = new Map<string, { at: number; videos: YouTubeVideo[] }>()
ipcMain.handle('dj:youtubeSearch', async (_e, query: string, limit = 20) => {
  const q = typeof query === 'string' ? query.trim().slice(0, 200) : ''
  if (!q) return { ok: false, videos: [], error: 'empty' }
  const n = Math.max(1, Math.min(40, Number(limit) || 20))
  const cached = ytCache.get(q)
  if (cached && Date.now() - cached.at < TTL_MS) return { ok: true, videos: cached.videos.slice(0, n) }
  try {
    const { status, body } = await withNetRetry(() => httpGet(searchUrl(q), 12000), 2, 600)
    if (status !== 200) return { ok: false, videos: [], error: `HTTP ${status}` }
    const videos = parseSearchResults(body, 40)
    if (!videos.length) return { ok: false, videos: [], error: 'no-results' }
    if (ytCache.size > 200) ytCache.clear()
    ytCache.set(q, { at: Date.now(), videos })
    return { ok: true, videos: videos.slice(0, n) }
  } catch (e: any) {
    return { ok: false, videos: [], error: e?.message || 'network' }
  }
})

ipcMain.handle('app:version', () => process.env.AIHUB_DJ_VERSION || app.getVersion())

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  // The decks capture their own YouTube player windows (tab capture → 'media')
  // and the recorder may use the microphone; everything else is refused.
  const allowed = new Set(['media', 'display-capture', 'fullscreen', 'clipboard-sanitized-write'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)))
  // YouTube's embedded player refuses a request that arrives without a
  // Referer ("Error 153 — video player configuration error"), and an
  // installed app loads from file://, which sends none. Exactly as AIHub
  // Browser does: say who is embedding, for YouTube requests only, and leave
  // any Referer a request already carries alone.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube-nocookie.com/*', 'https://www.youtube.com/*'] },
    (details, callback) => {
      const headers = { ...details.requestHeaders }
      if (!Object.keys(headers).some(k => k.toLowerCase() === 'referer')) headers['Referer'] = 'https://aihub-browser.app/'
      callback({ requestHeaders: headers })
    },
  )
  registerMediaProtocol()
  registerDjIpc()
  registerFactsIpc()
  registerAiIpc()
  createWindow()
  initAutoUpdater((channel, payload) => {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }, (version, ready) => {
    if (win?.isFocused() || !Notification.isSupported()) return
    try {
    const notification = new Notification({
      title: ready ? 'AIHub DJ update ready' : 'AIHub DJ update available',
      body: ready ? `Version ${version} is ready. Open AIHub DJ to restart and install.` : `Version ${version} is available. Open AIHub DJ to download it.`,
    })
    notification.on('click', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus() } })
    notification.show()
    } catch { /* Windows notification settings must not interrupt updating. */ }
  })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('before-quit', flushFacts)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
