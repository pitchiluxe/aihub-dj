#!/usr/bin/env node
// Starts electron-vite dev without ELECTRON_RUN_AS_NODE: some shells (and
// Claude Code) set it, and it turns electron.exe into plain Node, which then
// rejects every Chromium switch.
delete process.env.ELECTRON_RUN_AS_NODE
const { spawn } = require('child_process')
const child = spawn('npx', ['electron-vite', 'dev'], { stdio: 'inherit', shell: true, env: process.env })
child.on('exit', code => process.exit(code ?? 0))
