import {
  IPC_CHANNELS,
  type CreateTaskRequest,
  type FocusFlowApi,
  type MonthStatsRequest,
  type ReorderTasksRequest,
  type StartTimerRequest,
  type UpdateSettingsRequest,
  type UpdateTaskRequest,
  type WindowDragRequest
} from '@shared/contracts'
import type {
  AppSettings,
  FocusStats,
  MonthStats,
  Task,
  TaskBoardSnapshot,
  ThemePreference,
  TimerSnapshot
} from '@shared/types'

import { notifyTimerCompletion } from './notify'

const RPC_URL = '/api/rpc'
const EVENTS_URL = '/api/events'

const rpc = async <T>(channel: string, payload?: unknown): Promise<T> => {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, ...(payload === undefined ? {} : { payload }) })
  })

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? `RPC failed: ${channel}`
    throw new Error(message)
  }

  return body as T
}

const resolveTheme = async (): Promise<Exclude<ThemePreference, 'system'>> => {
  const settingsValue = await rpc<AppSettings>(IPC_CHANNELS.settings.get)
  if (settingsValue.themePreference === 'dark') return 'dark'
  if (settingsValue.themePreference === 'light') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const createWebFocusFlowApi = (): FocusFlowApi => ({
  timer: {
    getSnapshot: () => rpc<TimerSnapshot>(IPC_CHANNELS.timer.getSnapshot),
    start: (request?: StartTimerRequest) => rpc<TimerSnapshot>(IPC_CHANNELS.timer.start, request),
    bindCurrentTask: (taskId: string | null) => rpc<TimerSnapshot>(IPC_CHANNELS.timer.bindCurrentTask, taskId),
    pause: () => rpc<TimerSnapshot>(IPC_CHANNELS.timer.pause),
    resume: () => rpc<TimerSnapshot>(IPC_CHANNELS.timer.resume),
    skip: () => rpc<TimerSnapshot>(IPC_CHANNELS.timer.skip),
    reset: () => rpc<TimerSnapshot>(IPC_CHANNELS.timer.reset),
    onSnapshot: (listener: (snapshot: TimerSnapshot) => void) => {
      const source = new EventSource(EVENTS_URL)
      const notified = new Set<string>()
      source.onmessage = (event) => {
        let snapshot: TimerSnapshot
        try {
          snapshot = JSON.parse(event.data) as TimerSnapshot
        } catch {
          return
        }
        listener(snapshot)
        if (snapshot.status === 'completed' && snapshot.sessionId && !notified.has(snapshot.sessionId)) {
          notified.add(snapshot.sessionId)
          void rpc<AppSettings>(IPC_CHANNELS.settings.get)
            .then((settingsValue) => notifyTimerCompletion(snapshot, settingsValue))
            .catch(() => {})
        }
      }
      return () => source.close()
    }
  },
  tasks: {
    getBoard: () => rpc<TaskBoardSnapshot>(IPC_CHANNELS.tasks.getBoard),
    list: () => rpc<Task[]>(IPC_CHANNELS.tasks.list),
    create: (request: CreateTaskRequest) => rpc<Task>(IPC_CHANNELS.tasks.create, request),
    update: (request: UpdateTaskRequest) => rpc<Task>(IPC_CHANNELS.tasks.update, request),
    complete: (id: string) => rpc<Task>(IPC_CHANNELS.tasks.complete, id),
    restore: (id: string) => rpc<Task>(IPC_CHANNELS.tasks.restore, id),
    reorder: (request: ReorderTasksRequest) => rpc<void>(IPC_CHANNELS.tasks.reorder, request),
    delete: (id: string) => rpc<void>(IPC_CHANNELS.tasks.delete, id)
  },
  settings: {
    get: () => rpc<AppSettings>(IPC_CHANNELS.settings.get),
    update: (request: UpdateSettingsRequest) => rpc<AppSettings>(IPC_CHANNELS.settings.update, request)
  },
  stats: {
    get: () => rpc<FocusStats>(IPC_CHANNELS.stats.get),
    getMonth: (request: MonthStatsRequest) => rpc<MonthStats>(IPC_CHANNELS.stats.getMonth, request)
  },
  system: {
    getTheme: resolveTheme,
    showWindow: () => Promise.resolve(),
    showMiniWindow: () => Promise.resolve(),
    beginWindowDrag: (_request: WindowDragRequest) => {},
    updateWindowDrag: (_request: WindowDragRequest) => {},
    endWindowDrag: () => {},
    resizeWindow: () => Promise.resolve(),
    minimizeWindow: () => Promise.resolve(),
    toggleMaximizeWindow: () => Promise.resolve(),
    closeWindow: () => Promise.resolve(),
    quit: () => Promise.resolve()
  }
})
