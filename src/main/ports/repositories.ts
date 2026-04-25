import type { AppEvent, AppSettings, CompletionReason, Task, TimerPhase, TimerSession, TimerState } from '@shared/types'

export interface CreateTimerSessionInput {
  phase: TimerPhase
  taskId: string | null
  startedAt: string
  durationMs: number
}

export interface FinishTimerSessionInput {
  id: string
  endedAt: string
  actualDurationMs: number
  completed: boolean
  completionReason: CompletionReason
}

export interface TaskRepository {
  list(): Promise<Task[]>
  create(title: string, now?: string): Promise<Task>
  updateTitle(id: string, title: string, now?: string): Promise<Task>
  complete(id: string, now?: string): Promise<Task>
  restore(id: string, now?: string): Promise<Task>
  reorderActive(ids: string[], now?: string): Promise<void>
  delete(id: string): Promise<void>
  countCompletedOn(dateKey: string): Promise<number>
}

export interface TimerSessionRepository {
  list(): Promise<TimerSession[]>
  create(input: CreateTimerSessionInput): Promise<TimerSession>
  finish(input: FinishTimerSessionInput): Promise<void>
  findActive(): Promise<TimerSession | null>
}

export interface SettingsRepository {
  get(): Promise<AppSettings>
  update(patch: Partial<AppSettings>): Promise<AppSettings>
}

export interface TimerRuntimeRepository {
  get(): Promise<TimerState | null>
  save(state: TimerState): Promise<void>
}

export interface AppEventRepository {
  record(type: string, payload: Record<string, unknown>, now?: string): Promise<AppEvent>
  list(): Promise<AppEvent[]>
}
