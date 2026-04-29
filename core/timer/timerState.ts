import { getNormalizedNumericSetting } from '@shared/settingsValidation'
import type { AppSettings, TimerPhase, TimerSession, TimerSnapshot, TimerState } from '@shared/types'

export interface StartTimerInput {
  now: number
  phase: TimerPhase
  taskId?: string | null
  sessionId?: string | null
  settings: AppSettings
}

export interface RestoreTimerInput {
  session: TimerSession
  now: number
}

export interface RestoreTimerResult {
  action: 'resume' | 'needs-confirmation'
  state: TimerState
}

export const phaseDurationMs = (phase: TimerPhase, settings: AppSettings): number => {
  if (phase === 'focus') return getNormalizedNumericSetting(settings, 'focusMinutes') * 60_000
  if (phase === 'shortBreak') return getNormalizedNumericSetting(settings, 'shortBreakMinutes') * 60_000
  return getNormalizedNumericSetting(settings, 'longBreakMinutes') * 60_000
}

export const createIdleTimer = (settings: AppSettings, now: number): TimerState => ({
  status: 'idle',
  phase: 'focus',
  taskId: null,
  startedAt: null,
  targetEndAt: null,
  durationMs: phaseDurationMs('focus', settings),
  remainingMs: phaseDurationMs('focus', settings),
  focusCount: 0,
  unboundFocusCount: 0,
  lastFocusTaskId: null,
  sessionId: null,
  updatedAt: now
})

export const startTimer = (state: TimerState, input: StartTimerInput): TimerState => {
  const durationMs = phaseDurationMs(input.phase, input.settings)
  const nextTaskId = input.taskId ?? null
  const isTaskBoundFocus = input.phase === 'focus' && nextTaskId !== null

  return {
    ...state,
    status: 'running',
    phase: input.phase,
    taskId: nextTaskId,
    sessionId: input.sessionId ?? null,
    startedAt: input.now,
    targetEndAt: input.now + durationMs,
    durationMs,
    remainingMs: durationMs,
    unboundFocusCount: isTaskBoundFocus ? 0 : state.unboundFocusCount,
    updatedAt: input.now
  }
}

export const deriveTimerSnapshot = (state: TimerState, now: number): TimerSnapshot => {
  if (state.status === 'running' && state.startedAt !== null && state.targetEndAt !== null) {
    const remainingMs = Math.max(0, state.targetEndAt - now)
    const elapsedMs = Math.min(state.durationMs, Math.max(0, now - state.startedAt))
    const progress = state.durationMs === 0 ? 1 : elapsedMs / state.durationMs

    return {
      ...state,
      status: remainingMs === 0 ? 'completed' : state.status,
      remainingMs,
      elapsedMs,
      progress
    }
  }

  const elapsedMs = Math.max(0, state.durationMs - state.remainingMs)

  return {
    ...state,
    elapsedMs,
    progress: state.durationMs === 0 ? 0 : elapsedMs / state.durationMs
  }
}

export const pauseTimer = (state: TimerState, now: number): TimerState => {
  if (state.status !== 'running') return state
  const snapshot = deriveTimerSnapshot(state, now)

  return {
    ...state,
    status: 'paused',
    remainingMs: snapshot.remainingMs,
    startedAt: null,
    targetEndAt: null,
    updatedAt: now
  }
}

export const resumeTimer = (state: TimerState, now: number): TimerState => {
  if (state.status !== 'paused') return state

  return {
    ...state,
    status: 'running',
    startedAt: now,
    targetEndAt: now + state.remainingMs,
    updatedAt: now
  }
}

export const completeTimer = (state: TimerState, now: number): TimerState => ({
  ...state,
  status: 'completed',
  remainingMs: 0,
  targetEndAt: now,
  focusCount: state.phase === 'focus' ? state.focusCount + 1 : state.focusCount,
  unboundFocusCount:
    state.phase === 'focus' && state.taskId === null ? state.unboundFocusCount + 1 : state.unboundFocusCount,
  lastFocusTaskId: state.phase === 'focus' ? state.taskId : state.lastFocusTaskId,
  updatedAt: now
})

export const getNextPhase = (phase: TimerPhase, completedFocusCount: number, settings: AppSettings): TimerPhase => {
  if (phase !== 'focus') return 'focus'
  return completedFocusCount % getNormalizedNumericSetting(settings, 'longBreakInterval') === 0 ? 'longBreak' : 'shortBreak'
}

export const restoreTimerFromSession = (input: RestoreTimerInput): RestoreTimerResult => {
  const startedAt = new Date(input.session.startedAt).getTime()
  const targetEndAt = startedAt + input.session.durationMs
  const remainingMs = Math.max(0, targetEndAt - input.now)
  const baseState: TimerState = {
    status: remainingMs === 0 ? 'completed' : 'running',
    phase: input.session.phase,
    taskId: input.session.taskId,
    sessionId: input.session.id,
    startedAt,
    targetEndAt,
    durationMs: input.session.durationMs,
    remainingMs,
    focusCount: 0,
    unboundFocusCount: 0,
    lastFocusTaskId: null,
    updatedAt: input.now
  }

  if (remainingMs === 0) {
    return {
      action: 'needs-confirmation',
      state: baseState
    }
  }

  return {
    action: 'resume',
    state: baseState
  }
}
