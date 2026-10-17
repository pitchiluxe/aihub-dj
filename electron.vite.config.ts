import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const pkgVersion = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')).version

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: { 'process.env.AIHUB_DJ_VERSION': JSON.stringify(pkgVersion) },
    build: { rollupOptions: { output: { format: 'cjs' } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { output: { format: 'cjs' } } },
  },
  renderer: {
    plugins: [react()],
    build: { sourcemap: false },
  },
})
