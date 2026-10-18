import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'

const script = () => fs.readFileSync('landing/release.js', 'utf8')
const run = async (release: unknown, ok = true) => {
  const version = { textContent: '1.1.0' }, link = { href: 'fallback' }, size = { textContent: 'Windows 10 / 11 · 64-bit' }
  const page = { getElementById: (id: string) => id === 'dl-version' ? version : id === 'dl-main' ? link : size }
  const fetch = vi.fn().mockResolvedValue({ ok, json: async () => release })
  await new Function('fetch', 'document', `return ${script()}`)(fetch, page)
  return { version, link }
}

describe('landing release download', () => {
  it('uses the stable Windows installer asset and its release version', async () => {
    const url = 'https://github.com/pitchiluxe/aihub-dj/releases/download/v1.2.0/AIHub-DJ-Setup.exe'
    const result = await run({ tag_name: 'v1.2.0', assets: [{ name: 'other.exe', browser_download_url: 'other' }, { name: 'AIHub-DJ-Setup.exe', browser_download_url: url }] })
    expect(result.link.href).toBe(url)
    expect(result.version.textContent).toBe('1.2.0')
  })
  it('does not advertise a version whose installer has not been uploaded', async () => {
    const result = await run({ tag_name: 'v1.2.0', assets: [] })
    expect(result.version.textContent).toBe('1.1.0')
    expect(result.link.href).toBe('fallback')
  })
  it('preserves the download fallback when GitHub is unavailable', async () => {
    expect((await run({}, false)).link.href).toBe('fallback')
  })
})
