import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = path.dirname(currentFilePath)

function readBackendPort() {
  const runtimeFile = path.resolve(currentDirPath, '../backend/.runtime/server-port.json')

  try {
    const parsed = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'))
    const port = Number(parsed?.port)

    if (Number.isInteger(port) && port > 0) {
      return port
    }
  } catch {
    // Fall back to the default dev port when the runtime file is missing.
  }

  return 5001
}

const backendPort = readBackendPort()
const backendTarget = `http://localhost:${backendPort}`

// https://vite.dev/config/
export default defineConfig({
  envDir: '../backend',
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: false,
    middlewareMode: false,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true
      },
      '/legacy': {
        target: backendTarget,
        changeOrigin: true
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true
      }
    }
  }
})
