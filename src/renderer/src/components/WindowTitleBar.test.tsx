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
  })

  test('does not render the mini window button when no mini window action is provided', () => {
    const html = renderToStaticMarkup(<WindowTitleBar activeTheme="dark" onToggleTheme={noop} />)

    expect(html).not.toContain('aria-label="显示小窗"')
  })
})
