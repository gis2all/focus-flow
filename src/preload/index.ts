import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type FocusFlowApi } from '@shared/contracts'
import type { TimerSnapshot } from '@shared/types'

const api: FocusFlowApi = {
  timer: {
    getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.timer.getSnapshot),
    start: (request) => ipcRenderer.invoke(IPC_CHANNELS.timer.start, request),
    pause: () => ipcRenderer.invoke(IPC_CHANNELS.timer.pause),
    resume: () => ipcRenderer.invoke(IPC_CHANNELS.timer.resume),
    skip: () => ipcRenderer.invoke(IPC_CHANNELS.timer.skip),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.timer.reset),
    onSnapshot: (listener: (snapshot: TimerSnapshot) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, snapshot: TimerSnapshot): void => listener(snapshot)
      ipcRenderer.on(IPC_CHANNELS.timer.snapshot, handler)
      return () => ipcRenderer.off(IPC_CHANNELS.timer.snapshot, handler)
    }
  },
  tasks: {
    getBoard: () => ipcRenderer.invoke(IPC_CHANNELS.tasks.getBoard),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.tasks.list),
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.tasks.create, request),
    update: (request) => ipcRenderer.invoke(IPC_CHANNELS.tasks.update, request),
    complete: (id) => ipcRenderer.invoke(IPC_CHANNELS.tasks.complete, id),
    restore: (id) => ipcRenderer.invoke(IPC_CHANNELS.tasks.restore, id),
    reorder: (request) => ipcRenderer.invoke(IPC_CHANNELS.tasks.reorder, request),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.tasks.delete, id)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settings.get),
    update: (request) => ipcRenderer.invoke(IPC_CHANNELS.settings.update, request)
  },
  stats: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.stats.get)
  },
  system: {
    getTheme: () => ipcRenderer.invoke(IPC_CHANNELS.system.getTheme),
    showWindow: () => ipcRenderer.invoke(IPC_CHANNELS.system.showWindow),
    minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.system.minimizeWindow),
    toggleMaximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.system.toggleMaximizeWindow),
    closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.system.closeWindow),
    quit: () => ipcRenderer.invoke(IPC_CHANNELS.system.quit)
  }
}

contextBridge.exposeInMainWorld('focusFlow', api)
