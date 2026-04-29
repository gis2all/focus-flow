import type { MenuItemConstructorOptions } from 'electron'

interface TrayMenuHandlers {
  showMainWindow(): void
  showMiniWindow(): void
  quit(): void
}

export const buildTrayMenuTemplate = ({
  showMainWindow,
  showMiniWindow,
  quit
}: TrayMenuHandlers): MenuItemConstructorOptions[] => [
  { label: '显示主窗口', click: () => showMainWindow() },
  { label: '显示小窗', click: () => showMiniWindow() },
  { label: '退出', click: () => quit() }
]
