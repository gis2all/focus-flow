import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const alias = {
  '@core': resolve('core'),
  '@main': resolve('main'),
  '@preload': resolve('preload'),
  '@renderer': resolve('renderer'),
  '@shared': resolve('shared')
}

export default defineConfig({
  root: resolve('renderer'),
  plugins: [react()],
  resolve: { alias },
  server: {
    port: 5273,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:5274'
    }
  }
})
