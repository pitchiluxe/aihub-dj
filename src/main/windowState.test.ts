import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { fitBounds, DEFAULT_SIZE } from './windowState'

const fullHd = { x: 0, y: 0, width: 1920, height: 1040 }
const laptop = { x: 0, y: 0, width: 1366, height: 728 }

describe('window state', () => {
  it('first launch opens a default-size window centred on the screen', () => {
    const r = fitBounds(null, [fullHd], fullHd)
    expect(r).toEqual({ ...DEFAULT_SIZE, x: 220, y: 60 })
  })

  it('a small screen gets 90% of it, never the whole screen', () => {
    const r = fitBounds(null, [laptop], laptop)
    expect(r.width).toBe(1229)
    expect(r.height).toBe(655)
    expect(r.width).toBeLessThan(laptop.width)
  })

  it('reopens where the window was left', () => {
    const saved = { x: 100, y: 80, width: 1300, height: 800 }
    expect(fitBounds(saved, [fullHd], fullHd)).toEqual(saved)
  })

  it('a window left on an unplugged monitor comes back to the main screen', () => {
    const r = fitBounds({ x: 2500, y: 100, width: 1300, height: 800 }, [fullHd], fullHd)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.x + r.width).toBeLessThanOrEqual(fullHd.width)
  })

  it('a saved window bigger than the screen is shrunk to fit', () => {
    const r = fitBounds({ x: 0, y: 0, width: 1900, height: 1000 }, [laptop], laptop)
    expect(r.width).toBeLessThanOrEqual(laptop.width)
    expect(r.height).toBeLessThanOrEqual(laptop.height)
  })

  it('the app never maximizes or goes full screen at launch', () => {
    const main = fs.readFileSync('src/main/index.ts', 'utf8')
    expect(main).not.toMatch(/\.maximize\(\)|setFullScreen\(true\)|fullscreen:\s*true|kiosk:\s*true/)
  })
})
