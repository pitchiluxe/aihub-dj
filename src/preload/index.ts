/**
 * The bridge the DJ page talks through — the same `window.electronAPI.dj` and
 * `window.electronAPI.ai` shapes AIHub Browser exposes, so the DJ code runs
 * here unchanged.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  dj: {
    roots:         () => ipcRenderer.invoke('dj:roots'),
    list:          (dir: string) => ipcRenderer.invoke('dj:list', dir),
    search:        (dir: string, query: string) => ipcRenderer.invoke('dj:search', dir, query),
    meta:          (token: string) => ipcRenderer.invoke('dj:meta', token),
    pickFolder:    () => ipcRenderer.invoke('dj:pickFolder'),
    saveRecording: (data: ArrayBuffer, ext: string) => ipcRenderer.invoke('dj:saveRecording', data, ext),
    youtubeSearch: (query: string, limit?: number) => ipcRenderer.invoke('dj:youtubeSearch', query, limit),
    facts: {
      getMany: (ids: string[]) => ipcRenderer.invoke('dj:facts:getMany', ids),
      put:     (id: string, facts: unknown) => ipcRenderer.invoke('dj:facts:put', id, facts),
    },
    // Audio files dropped from the desktop: File.path is gone in modern Electron.
    pathForFile:   (file: File) => { try { return webUtils.getPathForFile(file) } catch { return '' } },
    registerFile:  (path: string) => ipcRenderer.invoke('dj:registerFile', path),
    // YouTube decks: a hidden player window per deck, captured into the mixer.
    yt: {
      load:     (deck: string, id: string) => ipcRenderer.invoke('dj:yt:load', deck, id),
      streamId: (deck: string) => ipcRenderer.invoke('dj:yt:streamId', deck),
      state:    (deck: string) => ipcRenderer.invoke('dj:yt:state', deck),
      cmd:      (deck: string, cmd: string, value?: unknown) => ipcRenderer.invoke('dj:yt:cmd', deck, cmd, value),
      unload:   (deck: string) => ipcRenderer.invoke('dj:yt:unload', deck),
      show:     (deck: string, rect: { x: number; y: number; width: number; height: number } | null) => ipcRenderer.invoke('dj:yt:show', deck, rect),
    },
  },
  ai: {
    chat: (msgs: unknown[]) => ipcRenderer.invoke('ai:chat', msgs),
    settings: {
      get: () => ipcRenderer.invoke('ai:settings:get'),
      set: (s: Record<string, unknown>) => ipcRenderer.invoke('ai:settings:set', s),
    },
    // Present for API parity; the DJ asks for whole answers, so nothing streams.
    onChunk: (_cb: (c: unknown) => void) => () => {},
  },
  appVersion: () => ipcRenderer.invoke('app:version'),
  // Auto-update (electron-updater against GitHub Releases).
  updater: {
    check:      () => ipcRenderer.invoke('updater:check'),
    download:   () => ipcRenderer.invoke('updater:download'),
    install:    () => ipcRenderer.invoke('updater:install'),
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),
    getState:   () => ipcRenderer.invoke('updater:getState'),
    onEvent: (cb: (e: unknown) => void) => {
      const h = (_e: unknown, payload: unknown) => cb(payload)
      ipcRenderer.on('updater:event', h)
      return () => ipcRenderer.removeListener('updater:event', h)
    },
  },
})
