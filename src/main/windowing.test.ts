import { describe, expect, test, vi } from 'vitest'
import {
  MINI_WINDOW_HEIGHT,
  MINI_WINDOW_PADDING,
  MINI_WINDOW_WIDTH,
  activateMainWindow,
  activateMiniWindow,
  createMiniWindowChromeOptions,
  resolveMiniWindowPosition
} from './windowing'

describe('windowing', () => {
  test('places a new mini window at the bottom-right corner of the primary work area', () => {
    expect(
      resolveMiniWindowPosition({
        savedPosition: null,
        displays: [
          {
            workArea: {
              x: 120,
              y: 80,
              width: 1600,
              height: 900
            }
          }
        ]
      })
    ).toEqual({
      x: 120 + 1600 - MINI_WINDOW_WIDTH - MINI_WINDOW_PADDING,
      y: 80 + 900 - MINI_WINDOW_HEIGHT - MINI_WINDOW_PADDING
    })
  })

  test('reuses a saved mini window position when it still fits on screen', () => {
    expect(
      resolveMiniWindowPosition({
        savedPosition: { x: 980, y: 540 },
        displays: [
          {
            workArea: {
              x: 0,
              y: 0,
              width: 1920,
              height: 1080
            }
          }
        ]
      })
    ).toEqual({ x: 980, y: 540 })
  })

  test('falls back to the primary display when a saved mini window position is off-screen', () => {
    expect(
      resolveMiniWindowPosition({
        savedPosition: { x: 4000, y: 3000 },
        displays: [
          {
            workArea: {
              x: 50,
              y: 40,
              width: 1440,
              height: 900
            }
          }
        ]
      })
    ).toEqual({
      x: 50 + 1440 - MINI_WINDOW_WIDTH - MINI_WINDOW_PADDING,
      y: 40 + 900 - MINI_WINDOW_HEIGHT - MINI_WINDOW_PADDING
    })
  })

  test('showing the main window always hides mini and restores focus to the main window', () => {
    const mainWindow = {
      isMinimized: vi.fn(() => true),
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn()
    }
    const miniWindow = {
      hide: vi.fn()
    }

    activateMainWindow(mainWindow, miniWindow)

    expect(miniWindow.hide).toHaveBeenCalledOnce()
    expect(mainWindow.restore).toHaveBeenCalledOnce()
    expect(mainWindow.show).toHaveBeenCalledOnce()
    expect(mainWindow.focus).toHaveBeenCalledOnce()
  })

  test('showing the mini window always hides the main window and focuses the mini window', () => {
    const mainWindow = {
      hide: vi.fn()
    }
    const miniWindow = {
      show: vi.fn(),
      focus: vi.fn()
    }

    activateMiniWindow(mainWindow, miniWindow)

    expect(mainWindow.hide).toHaveBeenCalledOnce()
    expect(miniWindow.show).toHaveBeenCalledOnce()
    expect(miniWindow.focus).toHaveBeenCalledOnce()
  })

  test('mini window chrome opts out of the native thick frame and uses transparency for clean rounded corners', () => {
    expect(createMiniWindowChromeOptions({ x: 320, y: 240 })).toMatchObject({
      width: MINI_WINDOW_WIDTH,
      height: MINI_WINDOW_HEIGHT,
      x: 320,
      y: 240,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      thickFrame: false
    })
  })
})
