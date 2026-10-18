// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UpdateBar from './UpdateBar'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
let host: HTMLDivElement, root: Root, event: (value: any) => void
let api: { getState: ReturnType<typeof vi.fn>; download: ReturnType<typeof vi.fn>; install: ReturnType<typeof vi.fn>; onEvent: ReturnType<typeof vi.fn> }
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  api = { getState: vi.fn().mockResolvedValue(null), download: vi.fn().mockResolvedValue({ ok: true }), install: vi.fn().mockResolvedValue({ ok: true }), onEvent: vi.fn(cb => { event = cb; return vi.fn() }) }
  ;(window as any).electronAPI = { updater: api }
})
afterEach(() => { act(() => root.unmount()); host.remove(); delete (window as any).electronAPI })
const render = () => act(async () => root.render(<UpdateBar />))

describe('update notification', () => {
  it('restores a downloaded update after a renderer reload', async () => {
    api.getState.mockResolvedValue({ type: 'downloaded', version: '1.2.0' })
    await render()
    expect(host.textContent).toContain('1.2.0')
    const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Restart'))!
    await act(async () => button.click())
    expect(api.install).toHaveBeenCalledOnce()
  })

  it('shows a failed download and lets the user retry', async () => {
    await render()
    act(() => event({ type: 'available', version: '1.2.0' }))
    api.download.mockResolvedValueOnce({ ok: false, error: 'Offline' })
    await act(async () => host.querySelector<HTMLButtonElement>('.aihub-update-btn')!.click())
    expect(host.textContent).toContain('Offline')
    expect(host.textContent).toContain('Retry download')
  })

  it('keeps background check errors silent', async () => {
    await render(); act(() => event({ type: 'error', message: 'Offline' }))
    expect(host.textContent).toBe('')
  })

  it('does not replace a fresh event with an older initial snapshot', async () => {
    let resolve!: (value: any) => void
    api.getState.mockReturnValue(new Promise(r => { resolve = r }))
    await render()
    act(() => event({ type: 'downloaded', version: '1.3.0' }))
    await act(async () => resolve({ type: 'available', version: '1.2.0' }))
    expect(host.textContent).toContain('1.3.0')
    expect(host.textContent).not.toContain('1.2.0')
  })
})
