import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const buildOutDir = (scope: 'main' | 'preload' | 'renderer') =>
  resolve('output', 'build', scope)

const alias = {
  '@core': resolve('src/core'),
  '@main': resolve('src/main'),
  '@preload': resolve('src/preload'),
  '@renderer': resolve('src/renderer/src'),
  '@shared': resolve('src/shared')
}

export default defineConfig({
  main: {
    build: {
      outDir: buildOutDir('main')
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias
    }
  },
  preload: {
    build: {
      outDir: buildOutDir('preload')
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias
    }
  },
  renderer: {
    build: {
      outDir: buildOutDir('renderer')
    },
    resolve: {
      alias
    },
    plugins: [react()]
  }
})
