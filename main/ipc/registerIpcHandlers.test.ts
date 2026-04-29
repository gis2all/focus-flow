import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { IpcServices } from './registerIpcHandlers'

const { handleMock, onMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  onMock: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  ipcMain: {
    handle: handleMock,
    on: onMock
  },
  screen: {
    getDisplayMatching: vi.fn(() => ({
      workArea: { x: 0, y: 0, width: 1200, height: 800 }
    })),
    getDisplayNearestPoint: vi.fn(() => ({
      workArea: { x: 0, y: 0, width: 1200, height: 800 }
    }))
  }
}))

import { registerIpcHandlers } from './registerIpcHandlers'

const createServices = (): IpcServices => {
  const timer = {
    getSnapshot: vi.fn(),
    start: vi.fn(),
    bindCurrentTask: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    skip: vi.fn(),
    reset: vi.fn(),
    applySettings: vi.fn(),
    onSnapshot: vi.fn(() => vi.fn())
  }

  return {
    timer,
    tasks: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      complete: vi.fn(),
      restore: vi.fn(),
      reorder: vi.fn()
    },
    taskDeletion: {
      delete: vi.fn()
    },
    taskBoard: {
      get: vi.fn()
    },
    settings: {
      get: vi.fn(),
      update: vi.fn()
    },
    stats: {
      get: vi.fn(),
      getMonth: vi.fn()
    },
    theme: {
      shouldUseDarkColors: vi.fn(() => false)
    },
    showMainWindow: vi.fn(),
    showMiniWindow: vi.fn(),
    getWindows: vi.fn(() => []),
    quit: vi.fn()
  } as unknown as IpcServices
}

describe('registerIpcHandlers', () => {
  beforeEach(() => {
    handleMock.mockClear()
    onMock.mockClear()
  })

  test('does not own the long-lived timer snapshot broadcast subscription', () => {
    const services = createServices()

    registerIpcHandlers(services)

    expect(services.timer.onSnapshot).not.toHaveBeenCalled()
  })
})
