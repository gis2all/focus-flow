interface PermissionSessionLike {
  setPermissionRequestHandler(
    handler: (webContents: unknown, permission: string, callback: (granted: boolean) => void) => void
  ): void
  setPermissionCheckHandler(handler: () => boolean): void
}

interface WebContentsSecurityTarget {
  session: PermissionSessionLike
  setWindowOpenHandler(handler: (details: { url: string }) => { action: 'deny' }): void
  on(eventName: 'will-navigate', listener: (event: { preventDefault(): void }) => void): void
}

export const createSecureWebPreferences = (preload: string) => ({
  preload,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webviewTag: false
})

export const hardenWebContents = (webContents: WebContentsSecurityTarget): void => {
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  webContents.on('will-navigate', (event) => event.preventDefault())
  webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  webContents.session.setPermissionCheckHandler(() => false)
}
