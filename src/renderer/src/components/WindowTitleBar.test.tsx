import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { WindowTitleBar } from './WindowTitleBar'

const noop = (): void => undefined

describe('WindowTitleBar', () => {
  test('renders the mini window button when the main window provides that action', () => {
    const html = renderToStaticMarkup(
      <WindowTitleBar activeTheme="light" onShowMiniWindow={noop} onToggleTheme={noop} />
    )

    expect(html).toContain('aria-label="显示小窗"')
    expect(html).toContain('aria-label="切换到深色模式"')
    expect(html).not.toContain('data-tooltip=')
  })

  test('does not render the mini window button when no mini window action is provided', () => {
    const html = renderToStaticMarkup(<WindowTitleBar activeTheme="dark" onToggleTheme={noop} />)

    expect(html).not.toContain('aria-label="显示小窗"')
    expect(html).toContain('aria-label="切换到浅色模式"')
    expect(html).toContain('aria-label="最小化"')
    expect(html).toContain('aria-label="最大化"')
    expect(html).toContain('aria-label="关闭"')
    expect(html).not.toContain('data-tooltip=')
  })
})
