import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import { SettingsView, getNextStepperValue, parseStepperDraft } from './SettingsView'

const renderSettings = (): string =>
  renderToStaticMarkup(
    <SettingsView activeTheme="dark" settings={defaultSettings} updateSettings={vi.fn(async () => undefined)} />
  )

describe('SettingsView', () => {
  test('renders one long settings page without inner tabs or helper hints', () => {
    const html = renderSettings()

    expect(html).toContain('基础体验')
    expect(html).toContain('计时节奏')
    expect(html).toContain('阶段切换')
    expect(html).toContain('启动与窗口')
    expect(html).toContain('外观')
    expect(html).not.toContain('快捷键')
    expect(html).not.toContain('数据管理')
    expect(html).not.toContain('关于')
    expect(html).not.toContain('当前显示')
  })

  test('uses custom select and stepper controls instead of native select and number inputs', () => {
    const html = renderSettings()

    expect(html).not.toContain('<select')
    expect(html).not.toContain('type="number"')
    expect(html).toContain('aria-haspopup="listbox"')
    expect(html).toContain('25 分钟')
    expect(html).toContain('4 轮')
    expect(html).toContain('aria-label="增加专注时长"')
    expect(html).toContain('aria-label="减少专注时长"')
  })

  test('merges short break and long break default behavior into one setting', () => {
    const html = renderSettings()

    expect(html).toContain('完成专注后')
    expect(html).toContain('完成短休 / 长休后')
    expect(html).not.toContain('完成短休后')
    expect(html).not.toContain('完成长休后')
  })

  test('stepper helpers clamp to the lower bound', () => {
    expect(getNextStepperValue(25, 'up')).toBe(26)
    expect(getNextStepperValue(25, 'down')).toBe(24)
    expect(getNextStepperValue(1, 'down')).toBe(1)
  })

  test('stepper draft parsing supports direct editing safely', () => {
    expect(parseStepperDraft('35', 25)).toBe(35)
    expect(parseStepperDraft('0', 25)).toBe(1)
    expect(parseStepperDraft('', 25)).toBe(25)
    expect(parseStepperDraft('abc', 25)).toBe(25)
  })
})
