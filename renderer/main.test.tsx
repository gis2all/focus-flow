import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const renderMock = vi.fn()
const createRootMock = vi.fn(() => ({ render: renderMock }))

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: createRootMock
  }
}))

vi.mock('./App', () => ({
  App: ({ windowMode }: { windowMode: string }) => React.createElement('div', { 'data-screen': 'app', 'data-window-mode': windowMode })
}))

vi.mock('./styles/tokens.css', () => ({}))

const setBrowserGlobals = (focusFlow?: unknown): void => {
  const documentElement = { dataset: {} as Record<string, string> }
  const body = { dataset: {} as Record<string, string> }

  vi.stubGlobal('window', {
    location: { search: '' },
    focusFlow
  })
  vi.stubGlobal('document', {
    body,
    documentElement,
    getElementById: vi.fn(() => ({}))
  })
}

const loadEntryMarkup = async (focusFlow?: unknown): Promise<string> => {
  setBrowserGlobals(focusFlow)
  await import('./main')
  const [element] = renderMock.mock.calls.at(-1) ?? []
  return renderToStaticMarkup(element)
}

describe('renderer entry', () => {
  beforeEach(() => {
    renderMock.mockReset()
    createRootMock.mockClear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('renders a browser fallback instead of the app when preload API is unavailable', async () => {
    const markup = await loadEntryMarkup()

    expect(markup).toContain('FocusFlow')
    expect(markup).toContain('Open the desktop app from Electron')
    expect(markup).not.toContain('data-screen="app"')
  })

  test('renders the app normally when preload API is available', async () => {
    const markup = await loadEntryMarkup({})

    expect(markup).toContain('data-screen="app"')
    expect(markup).toContain('data-window-mode="main"')
  })
})
