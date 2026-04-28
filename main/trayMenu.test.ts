import { describe, expect, test, vi } from 'vitest'
import { buildTrayMenuTemplate } from './trayMenu'

describe('trayMenu', () => {
  test('always includes both window switching entries without disabling them', () => {
    const template = buildTrayMenuTemplate({
      showMainWindow: vi.fn(),
      showMiniWindow: vi.fn(),
      startFocus: vi.fn(),
      pauseTimer: vi.fn(),
      skipPhase: vi.fn(),
      quit: vi.fn()
    })

    expect(template.some((item) => item.label === '显示主窗口')).toBe(true)
    expect(template.some((item) => item.label === '显示小窗')).toBe(true)
    expect(template.find((item) => item.label === '显示主窗口')?.enabled).not.toBe(false)
    expect(template.find((item) => item.label === '显示小窗')?.enabled).not.toBe(false)
  })

  test('wires both window switching menu items to the provided handlers', () => {
    const showMainWindow = vi.fn()
    const showMiniWindow = vi.fn()
    const template = buildTrayMenuTemplate({
      showMainWindow,
      showMiniWindow,
      startFocus: vi.fn(),
      pauseTimer: vi.fn(),
      skipPhase: vi.fn(),
      quit: vi.fn()
    })

    template.find((item) => item.label === '显示主窗口')?.click?.({} as never, undefined as never, undefined as never)
    template.find((item) => item.label === '显示小窗')?.click?.({} as never, undefined as never, undefined as never)

    expect(showMainWindow).toHaveBeenCalledOnce()
    expect(showMiniWindow).toHaveBeenCalledOnce()
  })
})
