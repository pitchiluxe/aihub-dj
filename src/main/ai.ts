/**
 * The AI DJ's language model.
 *
 * Local Ollama answers first — free, private, and what AIHub Browser uses by
 * default. OpenRouter is the fallback only when a key has been saved (stored
 * encrypted with the OS keychain via safeStorage, never in plain JSON).
 *
 * Answers `{ ok, content, provider, model }` — the fields the DJ reads.
 */
import { app, ipcMain, safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'
import { httpGet, httpPostJson } from './net'

type Msg = { role: string; content: unknown }
export interface AiResult { ok: boolean; content: string; provider: 'ollama' | 'openrouter' | 'none'; model?: string; error?: string }

interface AiSettings { ollamaUrl: string; ollamaModel: string; openRouterModel: string }
const DEFAULTS: AiSettings = { ollamaUrl: 'http://localhost:11434', ollamaModel: '', openRouterModel: 'openrouter/auto' }

const dir = () => app.getPath('userData')
const settingsFile = () => path.join(dir(), 'ai-settings.json')
const keyFile = () => path.join(dir(), 'openrouter.key.enc')

export function readSettings(): AiSettings {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) } } catch { return { ...DEFAULTS } }
}
function writeSettings(s: Partial<AiSettings>): AiSettings {
  const next = { ...readSettings(), ...s }
  fs.mkdirSync(dir(), { recursive: true })
  fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2))
  return next
}
function readKey(): string {
  try {
    const buf = fs.readFileSync(keyFile())
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : ''
  } catch { return '' }
}
function writeKey(key: string): boolean {
  if (!key) { try { fs.unlinkSync(keyFile()) } catch {} return true }
  if (!safeStorage.isEncryptionAvailable()) return false
  fs.mkdirSync(dir(), { recursive: true })
  fs.writeFileSync(keyFile(), safeStorage.encryptString(key))
  return true
}

/** Text-only messages: the DJ never sends images, and both APIs reject odd shapes. */
function clean(messages: Msg[]): { role: string; content: string }[] {
  return (Array.isArray(messages) ? messages : [])
    .map(m => ({ role: m?.role === 'system' || m?.role === 'assistant' ? m.role : 'user', content: typeof m?.content === 'string' ? m.content : '' }))
    .filter(m => m.content.trim())
}

// Small models that answer quickly on a laptop, best first; any installed chat model otherwise.
const PREFERRED = ['llama3.2:3b', 'llama3.2', 'qwen2.5:7b', 'qwen2.5', 'gemma2:9b', 'llama3.1:8b', 'mistral:7b', 'phi3:mini']
let modelCache: { at: number; models: string[] } | null = null

async function ollamaModels(base: string): Promise<string[]> {
  if (modelCache && Date.now() - modelCache.at < 60_000) return modelCache.models
  const { status, body } = await httpGet(`${base}/api/tags`, 8000)
  if (status !== 200) throw new Error(`Ollama HTTP ${status}`)
  const models = (JSON.parse(body).models || []).map((m: any) => String(m.name)).filter((n: string) => !/embed|:cloud/i.test(n))
  modelCache = { at: Date.now(), models }
  return models
}

function pickModel(installed: string[], configured: string): string {
  if (configured && installed.includes(configured)) return configured
  for (const p of PREFERRED) { const hit = installed.find(m => m === p || m.startsWith(`${p}:`) || m === `${p}:latest`); if (hit) return hit }
  return installed[0] || ''
}

async function askOllama(messages: { role: string; content: string }[], s: AiSettings): Promise<AiResult> {
  const base = s.ollamaUrl.replace(/\/+$/, '')
  const model = pickModel(await ollamaModels(base), s.ollamaModel)
  if (!model) throw new Error('No Ollama chat model installed (try: ollama pull llama3.2:3b)')
  const chars = messages.reduce((n, m) => n + m.content.length, 0)
  const numCtx = chars / 3.5 + 1536 <= 8192 ? 8192 : 16384
  // CPU-only machines prefill ~20 tokens/s: give a big prompt the time it needs.
  const timeout = Math.min(360_000, Math.max(120_000, (chars / 3.5) * 50))
  const { status, body } = await httpPostJson(`${base}/api/chat`, { model, messages, stream: false, keep_alive: '30m', options: { num_ctx: numCtx } }, {}, timeout)
  if (status !== 200) throw new Error(`Ollama HTTP ${status}: ${body.slice(0, 160)}`)
  const content = String(JSON.parse(body)?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  if (!content) throw new Error('Ollama returned an empty answer')
  return { ok: true, content, provider: 'ollama', model }
}

async function askOpenRouter(messages: { role: string; content: string }[], s: AiSettings, key: string): Promise<AiResult> {
  const model = s.openRouterModel || DEFAULTS.openRouterModel
  const { status, body } = await httpPostJson('https://openrouter.ai/api/v1/chat/completions', { model, messages },
    { Authorization: `Bearer ${key}`, 'HTTP-Referer': 'https://aihubbrowser.vercel.app', 'X-Title': 'AIHub DJ' }, 90_000)
  if (status !== 200) throw new Error(`OpenRouter HTTP ${status}: ${body.slice(0, 160)}`)
  const j = JSON.parse(body)
  const content = String(j?.choices?.[0]?.message?.content || '').trim()
  if (!content) throw new Error('OpenRouter returned an empty answer')
  return { ok: true, content, provider: 'openrouter', model: j?.model || model }
}

export async function chat(raw: Msg[]): Promise<AiResult> {
  const messages = clean(raw)
  if (!messages.length) return { ok: false, content: '', provider: 'none', error: 'empty' }
  const s = readSettings()
  let localError = ''
  try { return await askOllama(messages, s) } catch (e: any) { localError = e?.message || String(e) }
  const key = readKey()
  if (key) {
    try { return { ...(await askOpenRouter(messages, s, key)) } } catch (e: any) {
      return { ok: false, content: '', provider: 'none', error: `Ollama: ${localError} · OpenRouter: ${e?.message || e}` }
    }
  }
  return { ok: false, content: '', provider: 'none', error: `Ollama: ${localError}` }
}

export function registerAiIpc(): void {
  ipcMain.handle('ai:chat', (_e, messages: Msg[]) => chat(messages))
  ipcMain.handle('ai:settings:get', () => ({ ...readSettings(), hasOpenRouterKey: !!readKey() }))
  ipcMain.handle('ai:settings:set', (_e, s: Partial<AiSettings> & { openRouterKey?: string }) => {
    const { openRouterKey, ...rest } = s || {}
    const out = writeSettings({
      ...(typeof rest.ollamaUrl === 'string' && /^https?:\/\//.test(rest.ollamaUrl) ? { ollamaUrl: rest.ollamaUrl } : {}),
      ...(typeof rest.ollamaModel === 'string' ? { ollamaModel: rest.ollamaModel } : {}),
      ...(typeof rest.openRouterModel === 'string' ? { openRouterModel: rest.openRouterModel } : {}),
    })
    if (typeof openRouterKey === 'string') writeKey(openRouterKey.trim())
    modelCache = null
    return { ...out, hasOpenRouterKey: !!readKey() }
  })
}
