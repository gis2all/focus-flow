import { describe, expect, test, vi } from 'vitest'
import { createSecureWebPreferences, hardenWebContents } from './security'

describe('Electron window security', () => {
  test('creates sandboxed web preferences with no renderer Node.js access', () => {
    expect(createSecureWebPreferences('C:\\app\\preload.mjs')).toEqual({
      preload: 'C:\\app\\preload.mjs',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    })
  })

  test('denies child windows, renderer navigation, and permission requests', () => {
    const setWindowOpenHandler = vi.fn()
    const on = vi.fn()
    const setPermissionRequestHandler = vi.fn()
    const setPermissionCheckHandler = vi.fn()

    hardenWebContents({
      setWindowOpenHandler,
      on,
      session: {
        setPermissionRequestHandler,
        setPermissionCheckHandler
      }
    })

    const windowOpenHandler = setWindowOpenHandler.mock.calls[0]?.[0]
    expect(windowOpenHandler({ url: 'https://example.com' })).toEqual({ action: 'deny' })

    const willNavigate = on.mock.calls.find(([eventName]) => eventName === 'will-navigate')?.[1]
    const navigationEvent = { preventDefault: vi.fn() }
    willNavigate(navigationEvent)
    expect(navigationEvent.preventDefault).toHaveBeenCalledOnce()

    const permissionRequestHandler = setPermissionRequestHandler.mock.calls[0]?.[0]
    const permissionCallback = vi.fn()
    permissionRequestHandler(null, 'notifications', permissionCallback)
    expect(permissionCallback).toHaveBeenCalledWith(false)

    const permissionCheckHandler = setPermissionCheckHandler.mock.calls[0]?.[0]
    expect(permissionCheckHandler()).toBe(false)
  })
})
