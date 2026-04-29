import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['vitest.setup.ts'],
    include: [
      '{core,main,preload,renderer,shared}/**/*.test.ts',
      '{core,main,preload,renderer,shared}/**/*.test.tsx'
    ]
  },
  resolve: {
    alias: {
      '@core': resolve('core'),
      '@main': resolve('main'),
      '@preload': resolve('preload'),
      '@renderer': resolve('renderer'),
      '@shared': resolve('shared')
    }
  }
})
