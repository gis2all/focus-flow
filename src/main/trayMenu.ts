import type { MenuItemConstructorOptions } from 'electron'

interface TrayMenuHandlers {
  showMainWindow(): void
  showMiniWindow(): void
  startFocus(): void
  pauseTimer(): void
  skipPhase(): void
  quit(): void
}

export const buildTrayMenuTemplate = ({
  showMainWindow,
  showMiniWindow,
  startFocus,
  pauseTimer,
  skipPhase,
  quit
}: TrayMenuHandlers): MenuItemConstructorOptions[] => [
  { label: '显示主窗口', click: () => showMainWindow() },
  { label: '显示小窗', click: () => showMiniWindow() },
  { type: 'separator' },
  { label: '开始专注', click: () => startFocus() },
  { label: '暂停计时', click: () => pauseTimer() },
  { label: '跳过当前阶段', click: () => skipPhase() },
  { type: 'separator' },
  { label: '退出', click: () => quit() }
]
