import type {
  AppSettings,
  FocusStats,
  Task,
  TaskBoardSnapshot,
  ThemePreference,
  TimerPhase,
  TimerSnapshot
} from './types'

export const IPC_CHANNELS = {
  timer: {
    snapshot: 'timer:snapshot',
    getSnapshot: 'timer:get-snapshot',
    start: 'timer:start',
    pause: 'timer:pause',
    resume: 'timer:resume',
    skip: 'timer:skip',
    reset: 'timer:reset'
  },
  tasks: {
    getBoard: 'tasks:get-board',
    list: 'tasks:list',
    create: 'tasks:create',
    update: 'tasks:update',
    complete: 'tasks:complete',
    restore: 'tasks:restore',
    reorder: 'tasks:reorder',
    delete: 'tasks:delete'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update'
  },
  stats: {
    get: 'stats:get'
  },
  system: {
    getTheme: 'system:get-theme',
    showWindow: 'system:show-window',
    minimizeWindow: 'system:minimize-window',
    toggleMaximizeWindow: 'system:toggle-maximize-window',
    closeWindow: 'system:close-window',
    quit: 'system:quit'
  }
} as const

export interface StartTimerRequest {
  phase?: TimerPhase
  taskId?: string | null
}

export interface CreateTaskRequest {
  title: string
}

export interface UpdateTaskRequest {
  id: string
  title: string
}

export interface ReorderTasksRequest {
  ids: string[]
}

export interface UpdateSettingsRequest {
  patch: Partial<AppSettings>
}

export interface FocusFlowApi {
  timer: {
    getSnapshot(): Promise<TimerSnapshot>
    start(request?: StartTimerRequest): Promise<TimerSnapshot>
    pause(): Promise<TimerSnapshot>
    resume(): Promise<TimerSnapshot>
    skip(): Promise<TimerSnapshot>
    reset(): Promise<TimerSnapshot>
    onSnapshot(listener: (snapshot: TimerSnapshot) => void): () => void
  }
  tasks: {
    getBoard(): Promise<TaskBoardSnapshot>
    list(): Promise<Task[]>
    create(request: CreateTaskRequest): Promise<Task>
    update(request: UpdateTaskRequest): Promise<Task>
    complete(id: string): Promise<Task>
    restore(id: string): Promise<Task>
    reorder(request: ReorderTasksRequest): Promise<void>
    delete(id: string): Promise<void>
  }
  settings: {
    get(): Promise<AppSettings>
    update(request: UpdateSettingsRequest): Promise<AppSettings>
  }
  stats: {
    get(): Promise<FocusStats>
  }
  system: {
    getTheme(): Promise<Exclude<ThemePreference, 'system'>>
    showWindow(): Promise<void>
    minimizeWindow(): Promise<void>
    toggleMaximizeWindow(): Promise<void>
    closeWindow(): Promise<void>
    quit(): Promise<void>
  }
}
