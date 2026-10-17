/**
 * HTTP for the main process, through Chromium's network stack (electron.net):
 * system proxy and DNS settings apply, and a slow host never blocks the main
 * thread the way a timed-out Node socket close can.
 */
import { app, net } from 'electron'

export async function httpGet(url: string, timeoutMs = 10000): Promise<{ status: number; body: string }> {
  await app.whenReady()
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await net.fetch(url, { signal: ctl.signal, headers: { 'Accept-Language': 'en-US,en;q=0.9' } })
    return { status: res.status, body: await res.text() }
  } catch (e: any) {
    throw new Error(e?.name === 'AbortError' ? 'timeout' : (e?.message || 'network'))
  } finally {
    clearTimeout(timer)
  }
}

export async function httpPostJson(url: string, data: unknown, headers: Record<string, string> = {}, timeoutMs = 60000): Promise<{ status: number; body: string }> {
  await app.whenReady()
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await net.fetch(url, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data),
    })
    return { status: res.status, body: await res.text() }
  } catch (e: any) {
    throw new Error(e?.name === 'AbortError' ? 'timeout' : (e?.message || 'network'))
  } finally {
    clearTimeout(timer)
  }
}

/** Retry transient failures (timeouts, dropped connections) with linear backoff. */
export async function withNetRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 600): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e) {
      last = e
      if (i === attempts - 1) break
      await new Promise(r => setTimeout(r, delayMs * (i + 1)))
    }
  }
  throw last
}
