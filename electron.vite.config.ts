import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const buildOutDir = (scope: 'main' | 'preload' | 'renderer') =>
  resolve('output', 'build', scope)

const alias = {
  '@core': resolve('core'),
  '@main': resolve('main'),
  '@preload': resolve('preload'),
  '@renderer': resolve('renderer'),
  '@shared': resolve('shared')
}

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve('main', 'index.ts')
      },
      outDir: buildOutDir('main')
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias
    }
  },
  preload: {
    build: {
      lib: {
        entry: resolve('preload', 'index.ts')
      },
      outDir: buildOutDir('preload')
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias
    }
  },
  renderer: {
    root: resolve('renderer'),
    build: {
      rollupOptions: {
        input: resolve('renderer', 'index.html')
      },
      outDir: buildOutDir('renderer')
    },
    resolve: {
      alias
    },
    plugins: [react()]
  }
})
