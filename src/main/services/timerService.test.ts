import { describe, expect, test } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import type { AppEventRepository, SettingsRepository, TimerRuntimeRepository, TimerSessionRepository } from '@main/ports/repositories'
import type { TimerSession, TimerState } from '@shared/types'
import { TimerService } from './timerService'

class FakeClock {
  private value: number

  constructor(now: string) {
    this.value = new Date(now).getTime()
  }

  set(now: string): void {
    this.value = new Date(now).getTime()
  }

  now(): number {
    return this.value
  }

  nowIso(): string {
    return new Date(this.value).toISOString()
  }
}

const createSession = (input: Partial<TimerSession>): TimerSession => ({
  id: input.id ?? 'session-1',
  phase: input.phase ?? 'focus',
  taskId: input.taskId ?? null,
  startedAt: input.startedAt ?? '2026-04-25T09:00:00.000Z',
  endedAt: input.endedAt ?? null,
  durationMs: input.durationMs ?? 25 * 60_000,
  actualDurationMs: input.actualDurationMs ?? null,
  completed: input.completed ?? false,
  completionReason: input.completionReason ?? null,
  createdAt: input.createdAt ?? input.startedAt ?? '2026-04-25T09:00:00.000Z',
  updatedAt: input.updatedAt ?? input.startedAt ?? '2026-04-25T09:00:00.000Z'
})

const makeRepositories = (activeSession: TimerSession | null = null) => {
  const sessions: TimerSession[] = activeSession ? [activeSession] : []
  let runtimeState: TimerState | null = null
  const sessionRepository: TimerSessionRepository = {
    list: async () => sessions,
    findActive: async () => sessions.find((session) => session.endedAt === null && !session.completed) ?? null,
    create: async (input) => {
      const session = createSession({
        id: `session-${sessions.length + 1}`,
        ...input,
        createdAt: input.startedAt,
        updatedAt: input.startedAt
      })
      sessions.push(session)
      return session
    },
    finish: async (input) => {
      const session = sessions.find((item) => item.id === input.id)
      if (!session) throw new Error('missing session')
      session.endedAt = input.endedAt
      session.actualDurationMs = input.actualDurationMs
      session.completed = input.completed
      session.completionReason = input.completionReason
      session.updatedAt = input.endedAt
    }
  }
  const settingsRepository: SettingsRepository = {
    get: async () => defaultSettings,
    update: async (patch) => ({ ...defaultSettings, ...patch })
  }
  const runtimeRepository: TimerRuntimeRepository = {
    get: async () => runtimeState,
    save: async (state) => {
      runtimeState = { ...state }
    }
  }
  const events: Array<{ type: string; payload: Record<string, unknown> }> = []
  const eventRepository: AppEventRepository = {
    record: async (type, payload, now = new Date().toISOString()) => {
      events.push({ type, payload })
      return { id: `event-${events.length}`, type, payload, createdAt: now }
    },
    list: async () =>
      events.map((event, index) => ({
        id: `event-${index + 1}`,
        type: event.type,
        payload: event.payload,
        createdAt: '2026-04-25T09:00:00.000Z'
      }))
  }

  return { sessions, sessionRepository, settingsRepository, runtimeRepository, eventRepository, events }
}

describe('TimerService', () => {
  test('starts a task-bound focus session and exposes a running snapshot', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    const snapshot = await service.start({ phase: 'focus', taskId: 'task-1' })

    expect(snapshot.status).toBe('running')
    expect(snapshot.taskId).toBe('task-1')
    expect(repos.sessions).toHaveLength(1)
    expect(repos.sessions[0].durationMs).toBe(25 * 60_000)
  })

  test('abandons an active session when starting a new phase', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    await service.start({ phase: 'focus', taskId: 'task-1' })
    clock.set('2026-04-25T09:05:00.000Z')
    const snapshot = await service.start({ phase: 'shortBreak' })

    expect(snapshot.phase).toBe('shortBreak')
    expect(repos.sessions).toHaveLength(2)
    expect(repos.sessions[0].completed).toBe(false)
    expect(repos.sessions[0].completionReason).toBe('abandoned')
    expect(repos.sessions[0].actualDurationMs).toBe(5 * 60_000)
    expect(repos.sessions[1].endedAt).toBeNull()
  })

  test('reset abandons the current running session and returns to idle', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    await service.start({ phase: 'focus', taskId: 'task-1' })
    clock.set('2026-04-25T09:07:00.000Z')
    const snapshot = await service.reset()

    expect(snapshot.status).toBe('idle')
    expect(repos.sessions[0].completionReason).toBe('abandoned')
    expect(repos.sessions[0].actualDurationMs).toBe(7 * 60_000)
  })

  test('applies updated settings to an idle timer snapshot', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    const snapshot = await service.applySettings({ ...defaultSettings, focusMinutes: 45 })

    expect(snapshot.status).toBe('idle')
    expect(snapshot.durationMs).toBe(45 * 60_000)
    expect(snapshot.remainingMs).toBe(45 * 60_000)
  })

  test('restores a paused runtime state across app restart', async () => {
    const clock = new FakeClock('2026-04-25T09:20:00.000Z')
    const repos = makeRepositories()
    await repos.runtimeRepository.save({
      status: 'paused',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: null,
      targetEndAt: null,
      durationMs: 25 * 60_000,
      remainingMs: 12 * 60_000,
      focusCount: 2,
      sessionId: 'session-1',
      updatedAt: new Date('2026-04-25T09:13:00.000Z').getTime()
    })
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    const snapshot = await service.initialize()

    expect(snapshot.status).toBe('paused')
    expect(snapshot.remainingMs).toBe(12 * 60_000)
    expect(snapshot.focusCount).toBe(2)
  })

  test('uses runtime state to mark overdue running timers for confirmation', async () => {
    const clock = new FakeClock('2026-04-25T10:00:00.000Z')
    const repos = makeRepositories(
      createSession({
        id: 'session-1',
        phase: 'focus',
        startedAt: '2026-04-25T09:00:00.000Z',
        durationMs: 25 * 60_000
      })
    )
    await repos.runtimeRepository.save({
      status: 'running',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: new Date('2026-04-25T09:00:00.000Z').getTime(),
      targetEndAt: new Date('2026-04-25T09:25:00.000Z').getTime(),
      durationMs: 25 * 60_000,
      remainingMs: 25 * 60_000,
      focusCount: 1,
      sessionId: 'session-1',
      updatedAt: new Date('2026-04-25T09:00:00.000Z').getTime()
    })
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    const snapshot = await service.initialize()

    expect(snapshot.status).toBe('completed')
    expect(repos.sessions[0].completionReason).toBe('needs-confirmation')
    expect(repos.events[0]).toEqual({
      type: 'timer.restore',
      payload: { action: 'needs-confirmation', sessionId: 'session-1' }
    })
  })

  test('finishes a running phase on tick and triggers desktop feedback', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const desktopCalls: string[] = []
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      clock,
      notifier: {
        showTimerFinished: async () => {
          desktopCalls.push('notification')
        }
      },
      sound: {
        playTimerFinished: async () => {
          desktopCalls.push('sound')
        }
      }
    })

    await service.initialize()
    await service.start({ phase: 'focus', taskId: 'task-1' })
    clock.set('2026-04-25T09:25:00.000Z')
    const snapshot = await service.tick()

    expect(snapshot.status).toBe('completed')
    expect(repos.sessions[0].completed).toBe(true)
    expect(repos.sessions[0].actualDurationMs).toBe(25 * 60_000)
    expect(desktopCalls).toEqual(['notification', 'sound'])
  })

  test('restores an active session and flags overdue sessions without counting long offline time', async () => {
    const activeSession = createSession({
      id: 'session-1',
      phase: 'focus',
      startedAt: '2026-04-25T09:00:00.000Z',
      durationMs: 25 * 60_000
    })
    const clock = new FakeClock('2026-04-25T10:00:00.000Z')
    const repos = makeRepositories(activeSession)
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    const snapshot = await service.initialize()

    expect(snapshot.status).toBe('completed')
    expect(repos.sessions[0].completed).toBe(false)
    expect(repos.sessions[0].completionReason).toBe('needs-confirmation')
    expect(repos.events[0]).toEqual({
      type: 'timer.restore',
      payload: { action: 'needs-confirmation', sessionId: 'session-1' }
    })
  })
})
