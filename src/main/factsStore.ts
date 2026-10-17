/**
 * AI DJ facts (measured tempo / key / energy per track), kept between runs.
 * Writes are debounced and asynchronous: a set measures a song every couple
 * of minutes and none of it may block the UI.
 */
import { app, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { putFacts, type TrackFacts } from './dj/facts'

let cache: Record<string, TrackFacts> | null = null
let timer: NodeJS.Timeout | null = null
const file = () => path.join(app.getPath('userData'), 'dj-facts.json')

function all(): Record<string, TrackFacts> {
  if (!cache) { try { cache = JSON.parse(fs.readFileSync(file(), 'utf8')) || {} } catch { cache = {} } }
  return cache!
}
function saveSoon(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    fs.promises.mkdir(path.dirname(file()), { recursive: true })
      .then(() => fs.promises.writeFile(file(), JSON.stringify(cache)))
      .catch(() => { /* next put retries */ })
  }, 3000)
}

export function flushFacts(): void {
  if (!timer || !cache) return
  clearTimeout(timer); timer = null
  try { fs.writeFileSync(file(), JSON.stringify(cache)) } catch { /* best effort on quit */ }
}

export function registerFactsIpc(): void {
  ipcMain.handle('dj:facts:getMany', (_e, ids: unknown) => {
    const store = all()
    const out: Record<string, TrackFacts> = {}
    if (Array.isArray(ids)) for (const id of ids.slice(0, 500)) if (typeof id === 'string' && store[id]) out[id] = store[id]
    return out
  })
  ipcMain.handle('dj:facts:put', (_e, id: unknown, facts: unknown) => {
    if (typeof id !== 'string') return { ok: false }
    const before = all()
    const after = putFacts(before, id, facts as TrackFacts)
    if (after === before) return { ok: false }
    cache = after
    saveSoon()
    return { ok: true }
  })
}
