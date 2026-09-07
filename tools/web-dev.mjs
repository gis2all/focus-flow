import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const VITE_BIN = resolve('node_modules/vite/bin/vite.js')
const SERVER_CONFIG = resolve('vite.server.config.ts')
const SERVER_ENTRY = resolve('output/build/server/index.js')

const run = (args) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit' })
    child.on('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`command exited ${code}`))))
  })

const main = async () => {
  // Build the API server once so its entry is fresh.
  await run([VITE_BIN, 'build', '-c', SERVER_CONFIG])

  // Start the API + SSE server.
  const apiServer = spawn(process.execPath, [SERVER_ENTRY], {
    stdio: 'inherit',
    env: { ...process.env, FOCUSFLOW_WEB_PORT: '5274' }
  })

  // Start the renderer Vite dev server, proxying /api to the API server.
  const { createServer } = await import('vite')
  const react = (await import('@vitejs/plugin-react')).default
  const dev = await createServer({
    root: resolve('renderer'),
    plugins: [react()],
    resolve: {
      alias: {
        '@core': resolve('core'),
        '@main': resolve('main'),
        '@preload': resolve('preload'),
        '@renderer': resolve('renderer'),
        '@shared': resolve('shared')
      }
    },
    server: {
      port: 5273,
      strictPort: true,
      proxy: { '/api': 'http://127.0.0.1:5274' }
    }
  })
  await dev.listen()

  console.log('[web:dev] renderer on http://127.0.0.1:5273, api on http://127.0.0.1:5274')

  const cleanup = () => {
    dev.close().catch(() => {})
    apiServer.kill()
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

main().catch((error) => {
  console.error('[web:dev] failed', error)
  process.exit(1)
})
