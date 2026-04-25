export type TimerPhase = 'focus' | 'shortBreak' | 'longBreak'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'

export type CompletionReason = 'completed' | 'skipped' | 'abandoned' | 'needs-confirmation'

export type ThemePreference = 'system' | 'light' | 'dark'

export interface AppSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakInterval: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  notificationsEnabled: boolean
  soundEnabled: boolean
  openAtLogin: boolean
  startToTray: boolean
  closeToTray: boolean
  themePreference: ThemePreference
}

export interface Task {
  id: string
  title: string
  sortOrder: number
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskBoardItem {
  id: string
  title: string
  sortOrder: number
  completedAt: string | null
  createdAt: string
  updatedAt: string
  focusMinutes: number
  completedPomodoros: number
}

export interface TaskBoardCounts {
  all: number
  active: number
  completed: number
}

export interface TaskBoardSnapshot {
  counts: TaskBoardCounts
  activeItems: TaskBoardItem[]
  completedItems: TaskBoardItem[]
}

export interface TimerSession {
  id: string
  phase: TimerPhase
  taskId: string | null
  startedAt: string
  endedAt: string | null
  durationMs: number
  actualDurationMs: number | null
  completed: boolean
  completionReason: CompletionReason | null
  createdAt: string
  updatedAt: string
}

export interface TimerState {
  status: TimerStatus
  phase: TimerPhase
  taskId: string | null
  startedAt: number | null
  targetEndAt: number | null
  durationMs: number
  remainingMs: number
  focusCount: number
  sessionId: string | null
  updatedAt: number
}

export interface TimerSnapshot extends TimerState {
  elapsedMs: number
  progress: number
}

export interface TodayStats {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  completedPomodoros: number
  completedTasks: number
}

export interface DailyTrendPoint {
  date: string
  focusMinutes: number
  completedPomodoros: number
}

export interface TaskFocusPoint {
  taskId: string
  minutes: number
}

export interface FocusStats {
  today: TodayStats
  hourlyFocusMinutes: number[]
  weeklyTrend: DailyTrendPoint[]
  taskFocusMinutes: TaskFocusPoint[]
}

export interface AppEvent {
  id: string
  type: string
  payload: Record<string, unknown>
  createdAt: string
}
