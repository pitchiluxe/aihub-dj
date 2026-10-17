// Renders build/icon.svg at every Windows icon size with Electron's own
// Chromium (transparent, antialiased) and packs them into build/icon.ico
// (PNG-compressed entries, the format Windows Vista+ reads), plus
// build/icon.png at 512 px for the window/taskbar.
// Run: npx electron scripts/make-icon.cjs
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'), 'utf8')
const SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]

async function render(win, size) {
  const html = `<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}" style="display:block"></body></html>`
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
  await new Promise(r => setTimeout(r, 150))
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
  return img.resize({ width: size, height: size, quality: 'best' }).toPNG()
}

function ico(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4)
  const dir = Buffer.alloc(16 * pngs.length)
  let offset = 6 + dir.length
  pngs.forEach(({ size, png }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3)
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(png.length, o + 8); dir.writeUInt32LE(offset, o + 12)
    offset += png.length
  })
  return Buffer.concat([header, dir, ...pngs.map(p => p.png)])
}

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } })
  const pngs = []
  for (const size of SIZES) pngs.push({ size, png: await render(win, size) })
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), ico(pngs))
  fs.writeFileSync(path.join(root, 'build', 'icon.png'), await render(win, 512))
  fs.writeFileSync(path.join(root, 'build', 'icon-preview-48.png'), pngs.find(p => p.size === 48).png)
  console.log('icon.ico sizes:', SIZES.join(', '))
  app.quit()
})
