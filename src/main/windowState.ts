/**
 * Window size and position across launches.
 *
 * AIHub DJ opens as an ordinary window — never maximized or full screen — at
 * the size and place it was last left. The first launch, or a saved window
 * that no longer fits (a monitor was unplugged, the resolution dropped), gets
 * a comfortable window centred on the screen's work area instead.
 */
import fs from 'fs'
import path from 'path'

export interface Rect { x: number; y: number; width: number; height: number }

export const DEFAULT_SIZE = { width: 1480, height: 920 }
export const MIN_SIZE = { width: 1100, height: 680 }

/**
 * Where the window opens. `saved` is the last normal (un-maximized) bounds,
 * `areas` the work areas of the connected displays, `primary` the main one.
 * A saved window is reused only if most of it is on a connected display.
 */
export function fitBounds(saved: Rect | null, areas: Rect[], primary: Rect): Rect {
  if (saved && Number.isFinite(saved.width) && Number.isFinite(saved.height)) {
    const area = areas.find(a => overlap(saved, a) >= 0.6 * saved.width * saved.height)
    if (area) {
      const width = clamp(saved.width, Math.min(MIN_SIZE.width, area.width), area.width)
      const height = clamp(saved.height, Math.min(MIN_SIZE.height, area.height), area.height)
      return {
        width, height,
        x: clamp(saved.x, area.x, area.x + area.width - width),
        y: clamp(saved.y, area.y, area.y + area.height - height),
      }
    }
  }
  // First launch: the default size, or 90 % of a smaller screen, centred.
  const width = Math.min(DEFAULT_SIZE.width, Math.round(primary.width * 0.9))
  const height = Math.min(DEFAULT_SIZE.height, Math.round(primary.height * 0.9))
  return {
    width, height,
    x: primary.x + Math.round((primary.width - width) / 2),
    y: primary.y + Math.round((primary.height - height) / 2),
  }
}

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function loadBounds(dir: string): Rect | null {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(dir, 'window-state.json'), 'utf8'))
    return ['x', 'y', 'width', 'height'].every(k => typeof r?.[k] === 'number') ? r : null
  } catch {
    return null
  }
}

export function saveBounds(dir: string, r: Rect): void {
  try {
    fs.writeFileSync(path.join(dir, 'window-state.json'), JSON.stringify(r))
  } catch { /* a lost window position is not worth an error */ }
}
