import { BrowserWindow, ipcMain, screen } from 'electron'
import {
  IPC_CHANNELS,
  type CreateTaskRequest,
  type MonthStatsRequest,
  type ResizeWindowRequest,
  type ReorderTasksRequest,
  type StartTimerRequest,
  type UpdateSettingsRequest,
  type UpdateTaskRequest,
  type WindowDragRequest
} from '@shared/contracts'
import { MINI_WINDOW_HEIGHT, MINI_WINDOW_WIDTH } from '@main/windowing'
import type { AppSettings } from '@shared/types'
import type { SystemThemePort } from '@main/ports/desktop'
import { getSettingsUpdatePatch } from './settingsUpdateRequest'
import type { SettingsService } from '@main/services/settingsService'
import type { StatsService } from '@main/services/statsService'
import type { TaskBoardService } from '@main/services/taskBoardService'
import type { TaskDeletionService } from '@main/services/taskDeletionService'
import type { TaskService } from '@main/services/taskService'
import type { TimerService } from '@main/services/timerService'

export interface IpcServices {
  timer: TimerService
  tasks: TaskService
  taskDeletion: TaskDeletionService
  taskBoard: TaskBoardService
  settings: SettingsService
  stats: StatsService
  theme: SystemThemePort
  showMainWindow(): void | Promise<void>
  showMiniWindow(): void | Promise<void>
  getWindows(): BrowserWindow[]
  quit(): void
  onSettingsUpdated?(settings: AppSettings): void | Promise<void>
}

export const registerIpcHandlers = (services: IpcServices): void => {
  const activeWindowDrags = new Map<number, { offsetX: number; offsetY: number }>()

  const lockMiniWindowSize = (window: BrowserWindow): void => {
    window.setMinimumSize(MINI_WINDOW_WIDTH, MINI_WINDOW_HEIGHT)
    window.setMaximumSize(MINI_WINDOW_WIDTH, MINI_WINDOW_HEIGHT)
    window.setContentSize(MINI_WINDOW_WIDTH, MINI_WINDOW_HEIGHT)
  }

  const getSenderWindow = (webContentsId: number): BrowserWindow | null => {
    return services.getWindows().find((window) => window.webContents.id === webContentsId) ?? null
  }

  const resizeSenderWindow = (window: BrowserWindow, request: ResizeWindowRequest): void => {
    const width = Math.round(request.width)
    const height = Math.round(request.height)
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return
    }

    const currentBounds = window.getBounds()
    const workArea = screen.getDisplayMatching(currentBounds).workArea
    const nextBounds = {
      x: Math.max(workArea.x, Math.min(currentBounds.x, workArea.x + workArea.width - width)),
      y: Math.max(workArea.y, Math.min(currentBounds.y, workArea.y + workArea.height - height)),
      width,
      height
    }

    window.setMinimumSize(width, height)
    window.setMaximumSize(width, height)
    window.setContentSize(width, height)
    window.setBounds(nextBounds)
  }

  const beginSenderWindowDrag = (window: BrowserWindow, request: WindowDragRequest): void => {
    lockMiniWindowSize(window)
    const [windowX, windowY] = window.getPosition()
    activeWindowDrags.set(window.webContents.id, {
      offsetX: request.pointerScreenX - windowX,
      offsetY: request.pointerScreenY - windowY
    })
  }

  const updateSenderWindowDrag = (window: BrowserWindow, request: WindowDragRequest): void => {
    const dragState = activeWindowDrags.get(window.webContents.id)
    if (!dragState) return

    const workArea = screen.getDisplayNearestPoint({
      x: Math.round(request.pointerScreenX),
      y: Math.round(request.pointerScreenY)
    }).workArea
    const nextX = Math.max(
      workArea.x,
      Math.min(Math.round(request.pointerScreenX - dragState.offsetX), workArea.x + workArea.width - MINI_WINDOW_WIDTH)
    )
    const nextY = Math.max(
      workArea.y,
      Math.min(Math.round(request.pointerScreenY - dragState.offsetY), workArea.y + workArea.height - MINI_WINDOW_HEIGHT)
    )

    lockMiniWindowSize(window)
    window.setBounds({
      x: nextX,
      y: nextY,
      width: MINI_WINDOW_WIDTH,
      height: MINI_WINDOW_HEIGHT
    })
  }

  const endSenderWindowDrag = (webContentsId: number): void => {
    activeWindowDrags.delete(webContentsId)
  }

  const broadcastSnapshot = (snapshot: ReturnType<TimerService['getSnapshot']>): void => {
    for (const window of services.getWindows()) {
      window.webContents.send(IPC_CHANNELS.timer.snapshot, snapshot)
    }
  }

  ipcMain.handle(IPC_CHANNELS.timer.getSnapshot, () => services.timer.getSnapshot())
  ipcMain.handle(IPC_CHANNELS.timer.start, (_event, request?: StartTimerRequest) => services.timer.start(request))
  ipcMain.handle(IPC_CHANNELS.timer.bindCurrentTask, (_event, taskId: string | null) => services.timer.bindCurrentTask(taskId))
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
  ipcMain.handle(IPC_CHANNELS.tasks.delete, (_event, id: string) => services.taskDeletion.delete(id))

  ipcMain.handle(IPC_CHANNELS.settings.get, () => services.settings.get())
  ipcMain.handle(IPC_CHANNELS.settings.update, async (_event, request: UpdateSettingsRequest | unknown) => {
    const updated = await services.settings.update(getSettingsUpdatePatch(request))
    await services.timer.applySettings(updated)
    await services.onSettingsUpdated?.(updated)
    return updated
  })
  ipcMain.handle(IPC_CHANNELS.stats.get, () => services.stats.get())
  ipcMain.handle(IPC_CHANNELS.stats.getMonth, (_event, request: MonthStatsRequest) => services.stats.getMonth(request))

  ipcMain.handle(IPC_CHANNELS.system.getTheme, () => (services.theme.shouldUseDarkColors() ? 'dark' : 'light'))
  ipcMain.handle(IPC_CHANNELS.system.showWindow, () => services.showMainWindow())
  ipcMain.handle(IPC_CHANNELS.system.showMiniWindow, () => services.showMiniWindow())
  ipcMain.on(IPC_CHANNELS.system.beginWindowDrag, (event, request: WindowDragRequest) => {
    const window = getSenderWindow(event.sender.id)
    if (!window) return
    beginSenderWindowDrag(window, request)
  })
  ipcMain.on(IPC_CHANNELS.system.updateWindowDrag, (event, request: WindowDragRequest) => {
    const window = getSenderWindow(event.sender.id)
    if (!window) return
    updateSenderWindowDrag(window, request)
  })
  ipcMain.on(IPC_CHANNELS.system.endWindowDrag, (event) => {
    endSenderWindowDrag(event.sender.id)
  })
  ipcMain.handle(IPC_CHANNELS.system.resizeWindow, (event, request: ResizeWindowRequest) => {
    const window = getSenderWindow(event.sender.id)
    if (!window) return
    resizeSenderWindow(window, request)
  })
  ipcMain.handle(IPC_CHANNELS.system.minimizeWindow, (event) => {
    getSenderWindow(event.sender.id)?.minimize()
  })
  ipcMain.handle(IPC_CHANNELS.system.toggleMaximizeWindow, (event) => {
    const window = getSenderWindow(event.sender.id)
    if (!window) return
    if (window.isMaximized()) {
      window.unmaximize()
      return
    }
    window.maximize()
  })
  ipcMain.handle(IPC_CHANNELS.system.closeWindow, (event) => {
    getSenderWindow(event.sender.id)?.close()
    endSenderWindowDrag(event.sender.id)
  })
  ipcMain.handle(IPC_CHANNELS.system.quit, () => services.quit())

  services.timer.onSnapshot((snapshot) => {
    broadcastSnapshot(snapshot)
  })
}
