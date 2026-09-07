import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['vitest.setup.ts'],
    reporters: ['default', ['json', { outputFile: 'output/test-results.json' }]],
    include: [
      '{core,main,preload,renderer,shared}/**/*.test.ts',
      'server/**/*.test.ts',
      '{core,main,preload,renderer,shared}/**/*.test.tsx',
      'tools/**/*.test.mjs'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      // Only core business logic (unit-testable modules) is counted.
      // Shell/assembly/views are E2E-covered and excluded from unit coverage.
      include: [
        'core/**/*.ts',
        'server/rpc.ts',
        'shared/**/*.ts',
        'main/services/**/*.ts',
        'main/repositories/**/*.ts',
        'main/adapters/sqlite/**/*.ts',
        'main/adapters/notificationHelpers.ts',
        'main/ipc/requestValidation.ts',
        'main/ipc/settingsUpdateRequest.ts',
        'main/timerSnapshotBroadcast.ts',
        'main/windowing.ts',
        'renderer/viewModel.ts',
        'renderer/windowMode.ts',
        'renderer/timerActionConfirmation.ts'
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        '**/assets/**',
        'tools/**'
      ],
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 85,
        branches: 70
      }
    },
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
