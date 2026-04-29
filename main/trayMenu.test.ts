import { describe, expect, test, vi } from 'vitest'
import { buildTrayMenuTemplate } from './trayMenu'

describe('trayMenu', () => {
  test('only exposes the two window entries and quit without separators', () => {
    const template = buildTrayMenuTemplate({
      showMainWindow: vi.fn(),
      showMiniWindow: vi.fn(),
      quit: vi.fn()
    })

    expect(template).toHaveLength(3)
    expect(template.some((item) => item.label === '显示主窗口')).toBe(true)
    expect(template.some((item) => item.label === '显示小窗')).toBe(true)
    expect(template.some((item) => item.label === '退出')).toBe(true)
    expect(template.some((item) => item.type === 'separator')).toBe(false)
    expect(template.some((item) => item.label === '开始专注')).toBe(false)
    expect(template.some((item) => item.label === '暂停计时')).toBe(false)
    expect(template.some((item) => item.label === '跳过当前阶段')).toBe(false)
    expect(template.find((item) => item.label === '显示主窗口')?.enabled).not.toBe(false)
    expect(template.find((item) => item.label === '显示小窗')?.enabled).not.toBe(false)
  })

  test('wires the visible menu items to the provided handlers', () => {
    const showMainWindow = vi.fn()
    const showMiniWindow = vi.fn()
    const quit = vi.fn()
    const template = buildTrayMenuTemplate({
      showMainWindow,
      showMiniWindow,
      quit
    })

    template.find((item) => item.label === '显示主窗口')?.click?.({} as never, undefined as never, undefined as never)
    template.find((item) => item.label === '显示小窗')?.click?.({} as never, undefined as never, undefined as never)
    template.find((item) => item.label === '退出')?.click?.({} as never, undefined as never, undefined as never)

    expect(showMainWindow).toHaveBeenCalledOnce()
    expect(showMiniWindow).toHaveBeenCalledOnce()
    expect(quit).toHaveBeenCalledOnce()
  })
})
