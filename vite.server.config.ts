import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const alias = {
  '@core': resolve('core'),
  '@main': resolve('main'),
  '@preload': resolve('preload'),
  '@renderer': resolve('renderer'),
  '@shared': resolve('shared')
}

export default defineConfig({
  build: {
    ssr: true,
    outDir: resolve('output', 'build', 'server'),
    rollupOptions: {
      input: resolve('server', 'index.ts'),
      external: ['sql.js']
    }
  },
  resolve: { alias }
})
