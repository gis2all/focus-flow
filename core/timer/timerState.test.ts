import { describe, expect, test } from 'vitest'
import {
  completeTimer,
  createIdleTimer,
  deriveTimerSnapshot,
  getNextPhase,
  pauseTimer,
  phaseDurationMs,
  restoreTimerFromSession,
  resumeTimer,
  startTimer
} from './timerState'
import { defaultSettings } from '@shared/defaults'

const at = (iso: string): number => new Date(iso).getTime()

describe('timer state machine', () => {
  test('starts a focus timer from absolute time and task binding', () => {
    const state = startTimer(createIdleTimer(defaultSettings, at('2026-04-25T09:00:00.000')), {
      now: at('2026-04-25T09:00:00.000'),
      phase: 'focus',
      taskId: 'task-1',
      settings: defaultSettings
    })

    expect(state.status).toBe('running')
    expect(state.phase).toBe('focus')
    expect(state.taskId).toBe('task-1')
    expect(state.startedAt).toBe(at('2026-04-25T09:00:00.000'))
    expect(state.targetEndAt).toBe(at('2026-04-25T09:25:00.000'))
    expect(deriveTimerSnapshot(state, at('2026-04-25T09:10:00.000')).remainingMs).toBe(15 * 60_000)
  })

  test('pauses and resumes without losing remaining time', () => {
    const running = startTimer(createIdleTimer(defaultSettings, at('2026-04-25T09:00:00.000')), {
      now: at('2026-04-25T09:00:00.000'),
      phase: 'focus',
      settings: defaultSettings
    })

    const paused = pauseTimer(running, at('2026-04-25T09:05:00.000'))
    const resumed = resumeTimer(paused, at('2026-04-25T09:20:00.000'))

    expect(paused.status).toBe('paused')
    expect(paused.remainingMs).toBe(20 * 60_000)
    expect(resumed.status).toBe('running')
    expect(resumed.startedAt).toBe(at('2026-04-25T09:20:00.000'))
    expect(resumed.targetEndAt).toBe(at('2026-04-25T09:40:00.000'))
  })

  test('selects long break after the configured focus interval', () => {
    expect(getNextPhase('focus', 1, defaultSettings)).toBe('shortBreak')
    expect(getNextPhase('focus', 4, defaultSettings)).toBe('longBreak')
    expect(getNextPhase('shortBreak', 4, defaultSettings)).toBe('focus')
  })

  test('falls back to safe defaults when numeric settings are invalid', () => {
    const invalidSettings = {
      ...defaultSettings,
      focusMinutes: Number.NaN,
      shortBreakMinutes: Number.POSITIVE_INFINITY,
      longBreakMinutes: 0,
      longBreakInterval: 0
    }

    expect(phaseDurationMs('focus', invalidSettings)).toBe(defaultSettings.focusMinutes * 60_000)
    expect(phaseDurationMs('shortBreak', invalidSettings)).toBe(defaultSettings.shortBreakMinutes * 60_000)
    expect(phaseDurationMs('longBreak', invalidSettings)).toBe(defaultSettings.longBreakMinutes * 60_000)
    expect(getNextPhase('focus', 4, invalidSettings)).toBe('longBreak')

    const idle = createIdleTimer(invalidSettings, at('2026-04-25T09:00:00.000'))
    expect(idle.durationMs).toBe(defaultSettings.focusMinutes * 60_000)
    expect(Number.isFinite(idle.durationMs)).toBe(true)
  })

  test('restores an unfinished session when it is still inside the expected duration', () => {
    const restored = restoreTimerFromSession({
      session: {
        id: 'session-1',
        phase: 'focus',
        taskId: 'task-1',
        startedAt: '2026-04-25T09:00:00.000',
        endedAt: null,
        durationMs: 25 * 60_000,
        actualDurationMs: null,
        completed: false,
        completionReason: null,
        createdAt: '2026-04-25T09:00:00.000',
        updatedAt: '2026-04-25T09:00:00.000'
      },
      now: at('2026-04-25T09:10:00.000')
    })

    expect(restored.action).toBe('resume')
    expect(restored.state.status).toBe('running')
    expect(restored.state.remainingMs).toBe(15 * 60_000)
  })

  test('marks an overdue unfinished session for confirmation instead of counting offline time', () => {
    const restored = restoreTimerFromSession({
      session: {
        id: 'session-1',
        phase: 'focus',
        taskId: 'task-1',
        startedAt: '2026-04-25T09:00:00.000',
        endedAt: null,
        durationMs: 25 * 60_000,
        actualDurationMs: null,
        completed: false,
        completionReason: null,
        createdAt: '2026-04-25T09:00:00.000',
        updatedAt: '2026-04-25T09:00:00.000'
      },
      now: at('2026-04-25T10:00:00.000')
    })

    expect(restored.action).toBe('needs-confirmation')
    expect(restored.state.status).toBe('completed')
    expect(restored.state.remainingMs).toBe(0)
  })

  test('completes a task-bound focus without incrementing the unbound counter and remembers the task context', () => {
    const running = startTimer(createIdleTimer(defaultSettings, at('2026-04-25T09:00:00.000')), {
      now: at('2026-04-25T09:00:00.000'),
      phase: 'focus',
      taskId: 'task-1',
      settings: defaultSettings
    })

    const completed = completeTimer(running, at('2026-04-25T09:25:00.000')) as typeof running & {
      unboundFocusCount: number
      lastFocusTaskId: string | null
    }

    expect(completed.focusCount).toBe(1)
    expect(completed.unboundFocusCount).toBe(0)
    expect(completed.lastFocusTaskId).toBe('task-1')
  })

  test('completes an unbound focus by incrementing the unbound counter and clearing task context', () => {
    const running = startTimer(createIdleTimer(defaultSettings, at('2026-04-25T09:00:00.000')), {
      now: at('2026-04-25T09:00:00.000'),
      phase: 'focus',
      settings: defaultSettings
    })

    const completed = completeTimer(running, at('2026-04-25T09:25:00.000')) as typeof running & {
      unboundFocusCount: number
      lastFocusTaskId: string | null
    }

    expect(completed.focusCount).toBe(1)
    expect(completed.unboundFocusCount).toBe(1)
    expect(completed.lastFocusTaskId).toBeNull()
  })
})
