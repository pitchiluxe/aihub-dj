// Serves landing/ on http://localhost:5180 for a local preview.
const http = require('http')
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..', 'landing')
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' }
const port = Number(process.env.PORT) || 5180
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (p.endsWith('/')) p += 'index.html'
  const file = path.normalize(path.join(root, p))
  if (!file.startsWith(root)) { res.writeHead(403); return res.end() }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found') }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
    res.end(data)
  })
}).listen(port, () => console.log(`AIHub DJ landing on http://localhost:${port}`))
