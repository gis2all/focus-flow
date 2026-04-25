import { ipcMain, type BrowserWindow } from 'electron'
import {
  IPC_CHANNELS,
  type CreateTaskRequest,
  type ReorderTasksRequest,
  type StartTimerRequest,
  type UpdateSettingsRequest,
  type UpdateTaskRequest
} from '@shared/contracts'
import type { SystemThemePort } from '@main/ports/desktop'
import type { SettingsService } from '@main/services/settingsService'
import type { StatsService } from '@main/services/statsService'
import type { TaskBoardService } from '@main/services/taskBoardService'
import type { TaskService } from '@main/services/taskService'
import type { TimerService } from '@main/services/timerService'

export interface IpcServices {
  timer: TimerService
  tasks: TaskService
  taskBoard: TaskBoardService
  settings: SettingsService
  stats: StatsService
  theme: SystemThemePort
  getWindow(): BrowserWindow | null
  quit(): void
}

export const registerIpcHandlers = (services: IpcServices): void => {
  ipcMain.handle(IPC_CHANNELS.timer.getSnapshot, () => services.timer.getSnapshot())
  ipcMain.handle(IPC_CHANNELS.timer.start, (_event, request?: StartTimerRequest) => services.timer.start(request))
  ipcMain.handle(IPC_CHANNELS.timer.pause, () => services.timer.pause())
  ipcMain.handle(IPC_CHANNELS.timer.resume, () => services.timer.resume())
  ipcMain.handle(IPC_CHANNELS.timer.skip, () => services.timer.skip())
  ipcMain.handle(IPC_CHANNELS.timer.reset, () => services.timer.reset())

  ipcMain.handle(IPC_CHANNELS.tasks.getBoard, () => services.taskBoard.get())
  ipcMain.handle(IPC_CHANNELS.tasks.list, () => services.tasks.list())
  ipcMain.handle(IPC_CHANNELS.tasks.create, (_event, request: CreateTaskRequest) => services.tasks.create(request.title))
  ipcMain.handle(IPC_CHANNELS.tasks.update, (_event, request: UpdateTaskRequest) =>
    services.tasks.update(request.id, request.title)
  )
  ipcMain.handle(IPC_CHANNELS.tasks.complete, (_event, id: string) => services.tasks.complete(id))
  ipcMain.handle(IPC_CHANNELS.tasks.restore, (_event, id: string) => services.tasks.restore(id))
  ipcMain.handle(IPC_CHANNELS.tasks.reorder, (_event, request: ReorderTasksRequest) => services.tasks.reorder(request.ids))
  ipcMain.handle(IPC_CHANNELS.tasks.delete, (_event, id: string) => services.tasks.delete(id))

  ipcMain.handle(IPC_CHANNELS.settings.get, () => services.settings.get())
  ipcMain.handle(IPC_CHANNELS.settings.update, async (_event, request: UpdateSettingsRequest) => {
    const updated = await services.settings.update(request.patch)
    await services.timer.applySettings(updated)
    return updated
  })
  ipcMain.handle(IPC_CHANNELS.stats.get, () => services.stats.get())

  ipcMain.handle(IPC_CHANNELS.system.getTheme, () => (services.theme.shouldUseDarkColors() ? 'dark' : 'light'))
  ipcMain.handle(IPC_CHANNELS.system.showWindow, () => {
    const window = services.getWindow()
    window?.show()
    window?.focus()
  })
  ipcMain.handle(IPC_CHANNELS.system.minimizeWindow, () => {
    services.getWindow()?.minimize()
  })
  ipcMain.handle(IPC_CHANNELS.system.toggleMaximizeWindow, () => {
    const window = services.getWindow()
    if (!window) return
    if (window.isMaximized()) {
      window.unmaximize()
      return
    }
    window.maximize()
  })
  ipcMain.handle(IPC_CHANNELS.system.closeWindow, () => {
    services.getWindow()?.close()
  })
  ipcMain.handle(IPC_CHANNELS.system.quit, () => services.quit())

  services.timer.onSnapshot((snapshot) => {
    services.getWindow()?.webContents.send(IPC_CHANNELS.timer.snapshot, snapshot)
  })
}
