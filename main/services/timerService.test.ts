import { describe, expect, test } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import type {
  AppEventRepository,
  SettingsRepository,
  TaskRepository,
  TimerRuntimeRepository,
  TimerSessionRepository
} from '@main/ports/repositories'
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

const makeRepositories = (activeSession: TimerSession | null = null, settingsValue = defaultSettings) => {
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
    },
    updateTask: async (input) => {
      const session = sessions.find((item) => item.id === input.id)
      if (!session) throw new Error('missing session')
      session.taskId = input.taskId
      session.updatedAt = input.updatedAt
    },
    deleteHistoricalFocusByTaskId: async (taskId) => {
      for (let index = sessions.length - 1; index >= 0; index -= 1) {
        if (sessions[index].phase === 'focus' && sessions[index].taskId === taskId) {
          sessions.splice(index, 1)
        }
      }
    }
  }
  const settingsRepository: SettingsRepository = {
    get: async () => settingsValue,
    update: async (patch) => ({ ...settingsValue, ...patch })
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

const createSelectionService = (initialValue: string | null): Pick<TaskRepository, 'list'> & { set(taskId: string | null): void } => {
  let activeTaskIds = ['task-1', 'task-2', 'task-a', 'task-b', 'task-3', 'task-4']
  if (initialValue && !activeTaskIds.includes(initialValue)) {
    activeTaskIds = [...activeTaskIds, initialValue]
  }

  return {
    list: async () =>
      activeTaskIds.map((id, index) => ({
        id,
        title: id,
        sortOrder: index + 1,
        completedAt: null,
        createdAt: '2026-04-25T09:00:00.000Z',
        updatedAt: '2026-04-25T09:00:00.000Z'
      })),
    set(taskId: string | null): void {
      if (taskId && !activeTaskIds.includes(taskId)) {
        activeTaskIds = [...activeTaskIds, taskId]
      }
    }
  }
}

const readExtendedTimerState = <T extends object>(value: T): T & { unboundFocusCount: number; lastFocusTaskId: string | null } =>
  value as T & {
    unboundFocusCount: number
    lastFocusTaskId: string | null
  }

describe('TimerService', () => {
  test('starts an unbound focus session when no task is provided', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    const snapshot = await service.start({ phase: 'focus' })

    expect(snapshot.status).toBe('running')
    expect(snapshot.taskId).toBeNull()
    expect(repos.sessions).toHaveLength(1)
    expect(repos.sessions[0].durationMs).toBe(25 * 60_000)
  })

  test('starts a task-bound focus session when a task is provided explicitly', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    const snapshot = await service.start({ phase: 'focus', taskId: 'task-1' })

    expect(snapshot.status).toBe('running')
    expect(snapshot.taskId).toBe('task-1')
    expect(repos.sessions).toHaveLength(1)
    expect(repos.sessions[0].taskId).toBe('task-1')
  })

  test('abandons an active session when starting a new phase', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
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
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
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
    const selection = createSelectionService(null)
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
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
    const selection = createSelectionService('task-1')
    await repos.runtimeRepository.save({
      status: 'paused',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: null,
      targetEndAt: null,
      durationMs: 25 * 60_000,
      remainingMs: 12 * 60_000,
      focusCount: 2,
      unboundFocusCount: 0,
      lastFocusTaskId: null,
      sessionId: 'session-1',
      updatedAt: new Date('2026-04-25T09:13:00.000Z').getTime()
    })
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    const snapshot = await service.initialize()

    expect(snapshot.status).toBe('paused')
    expect(snapshot.remainingMs).toBe(12 * 60_000)
    expect(snapshot.focusCount).toBe(2)
  })

  test('defaults missing runtime display fields when restoring an older runtime state', async () => {
    const clock = new FakeClock('2026-04-25T09:20:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    repos.runtimeRepository.get = async () =>
      ({
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
      }) as TimerState
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    const snapshot = readExtendedTimerState(await service.initialize())

    expect(snapshot.status).toBe('paused')
    expect(snapshot.unboundFocusCount).toBe(0)
    expect(snapshot.lastFocusTaskId).toBeNull()
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
    const selection = createSelectionService('task-1')
    await repos.runtimeRepository.save({
      status: 'running',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: new Date('2026-04-25T09:00:00.000Z').getTime(),
      targetEndAt: new Date('2026-04-25T09:25:00.000Z').getTime(),
      durationMs: 25 * 60_000,
      remainingMs: 25 * 60_000,
      focusCount: 1,
      unboundFocusCount: 0,
      lastFocusTaskId: null,
      sessionId: 'session-1',
      updatedAt: new Date('2026-04-25T09:00:00.000Z').getTime()
    })
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
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
    const selection = createSelectionService('task-1')
    const desktopCalls: string[] = []
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
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
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
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

  test('restores focus count from completed focus sessions when runtime state is missing', async () => {
    const activeSession = createSession({
      id: 'session-4',
      phase: 'focus',
      taskId: 'task-4',
      startedAt: '2026-04-25T10:00:00.000Z',
      durationMs: 25 * 60_000
    })
    const clock = new FakeClock('2026-04-25T10:10:00.000Z')
    const repos = makeRepositories(activeSession)
    repos.sessions.unshift(
      createSession({
        id: 'session-1',
        phase: 'focus',
        taskId: 'task-1',
        startedAt: '2026-04-25T08:00:00.000Z',
        endedAt: '2026-04-25T08:25:00.000Z',
        completed: true,
        actualDurationMs: 25 * 60_000,
        completionReason: 'completed'
      }),
      createSession({
        id: 'session-2',
        phase: 'shortBreak',
        startedAt: '2026-04-25T08:25:00.000Z',
        endedAt: '2026-04-25T08:30:00.000Z',
        completed: true,
        actualDurationMs: 5 * 60_000,
        completionReason: 'completed',
        durationMs: 5 * 60_000
      }),
      createSession({
        id: 'session-3',
        phase: 'focus',
        taskId: 'task-3',
        startedAt: '2026-04-25T09:00:00.000Z',
        endedAt: '2026-04-25T09:25:00.000Z',
        completed: true,
        actualDurationMs: 25 * 60_000,
        completionReason: 'completed'
      })
    )
    const selection = createSelectionService('task-4')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    const snapshot = await service.initialize()

    expect(snapshot.status).toBe('running')
    expect(snapshot.focusCount).toBe(2)
  })

  test('rejects explicit focus starts bound to inactive tasks', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()

    await expect(service.start({ phase: 'focus', taskId: 'deleted-task' })).rejects.toThrow('Selected task must be active')
    expect(repos.sessions).toHaveLength(0)
  })

  test('auto-starts the next focus phase without binding a task after a break', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories(null, { ...defaultSettings, autoStartFocus: true })
    const selection = createSelectionService('task-a')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    await service.start({ phase: 'shortBreak' })
    clock.set('2026-04-25T09:05:00.000Z')

    const snapshot = await service.tick()

    expect(snapshot.phase).toBe('focus')
    expect(snapshot.taskId).toBeNull()
    expect(repos.sessions[0].taskId).toBeNull()
    expect(repos.sessions[1].taskId).toBeNull()
  })

  test('rejects invalid timer phases instead of treating them as long breaks', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()

    await expect(service.start({ phase: 'deepWork' as never })).rejects.toThrow('Invalid timer phase: deepWork')
    expect(repos.sessions).toHaveLength(0)
  })

  test('binds the running focus session to an active task', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    await service.start({ phase: 'focus', taskId: 'task-1' })
    clock.set('2026-04-25T09:03:00.000Z')

    const snapshot = await service.bindCurrentTask('task-2')

    expect(snapshot.status).toBe('running')
    expect(snapshot.phase).toBe('focus')
    expect(snapshot.taskId).toBe('task-2')
    expect(repos.sessions[0].taskId).toBe('task-2')
  })

  test('binding a running focus session resets the unbound display counter', async () => {
    const clock = new FakeClock('2026-04-25T09:03:00.000Z')
    const repos = makeRepositories(
      createSession({
        id: 'session-1',
        phase: 'focus',
        taskId: null,
        startedAt: '2026-04-25T09:00:00.000Z',
        durationMs: 25 * 60_000
      })
    )
    const selection = createSelectionService('task-1')
    await repos.runtimeRepository.save({
      status: 'running',
      phase: 'focus',
      taskId: null,
      startedAt: new Date('2026-04-25T09:00:00.000Z').getTime(),
      targetEndAt: new Date('2026-04-25T09:25:00.000Z').getTime(),
      durationMs: 25 * 60_000,
      remainingMs: 22 * 60_000,
      focusCount: 3,
      sessionId: 'session-1',
      updatedAt: new Date('2026-04-25T09:03:00.000Z').getTime(),
      unboundFocusCount: 2,
      lastFocusTaskId: null
    } as TimerState)
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    const snapshot = readExtendedTimerState(await service.bindCurrentTask('task-1'))

    expect(snapshot.taskId).toBe('task-1')
    expect(snapshot.unboundFocusCount).toBe(0)
  })

  test('unbinds the running focus session when binding task is null', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    await service.start({ phase: 'focus', taskId: 'task-1' })

    const snapshot = await service.bindCurrentTask(null)

    expect(snapshot.taskId).toBeNull()
    expect(repos.sessions[0].taskId).toBeNull()
  })

  test('unbinding a running focus session resets the unbound display counter', async () => {
    const clock = new FakeClock('2026-04-25T09:03:00.000Z')
    const repos = makeRepositories(
      createSession({
        id: 'session-1',
        phase: 'focus',
        taskId: 'task-1',
        startedAt: '2026-04-25T09:00:00.000Z',
        durationMs: 25 * 60_000
      })
    )
    const selection = createSelectionService('task-1')
    await repos.runtimeRepository.save({
      status: 'running',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: new Date('2026-04-25T09:00:00.000Z').getTime(),
      targetEndAt: new Date('2026-04-25T09:25:00.000Z').getTime(),
      durationMs: 25 * 60_000,
      remainingMs: 22 * 60_000,
      focusCount: 3,
      sessionId: 'session-1',
      updatedAt: new Date('2026-04-25T09:03:00.000Z').getTime(),
      unboundFocusCount: 2,
      lastFocusTaskId: null
    } as TimerState)
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    const snapshot = readExtendedTimerState(await service.bindCurrentTask(null))

    expect(snapshot.taskId).toBeNull()
    expect(snapshot.unboundFocusCount).toBe(0)
  })

  test('clears a deleted task binding from the current running focus session and publishes a snapshot', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    await service.start({ phase: 'focus', taskId: 'task-1' })
    const published: Array<ReturnType<TimerService['getSnapshot']>> = []
    const unsubscribe = service.onSnapshot((snapshot) => {
      published.push(snapshot)
    })

    clock.set('2026-04-25T09:03:00.000Z')
    await service.clearDeletedTaskBinding('task-1')
    unsubscribe()

    const snapshot = readExtendedTimerState(service.getSnapshot())
    const persistedState = readExtendedTimerState((await repos.runtimeRepository.get())!)

    expect(snapshot.status).toBe('running')
    expect(snapshot.phase).toBe('focus')
    expect(snapshot.taskId).toBeNull()
    expect(snapshot.unboundFocusCount).toBe(0)
    expect(repos.sessions[0].taskId).toBeNull()
    expect(persistedState.taskId).toBeNull()
    expect(published).toEqual([expect.objectContaining({ status: 'running', phase: 'focus', taskId: null })])
  })

  test('clears a deleted task binding from the current paused focus session and keeps it paused', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    await service.start({ phase: 'focus', taskId: 'task-1' })
    clock.set('2026-04-25T09:04:00.000Z')
    await service.pause()
    const published: Array<ReturnType<TimerService['getSnapshot']>> = []
    const unsubscribe = service.onSnapshot((snapshot) => {
      published.push(snapshot)
    })

    await service.clearDeletedTaskBinding('task-1')
    unsubscribe()

    const snapshot = readExtendedTimerState(service.getSnapshot())

    expect(snapshot.status).toBe('paused')
    expect(snapshot.phase).toBe('focus')
    expect(snapshot.taskId).toBeNull()
    expect(repos.sessions[0].taskId).toBeNull()
    expect(published).toEqual([expect.objectContaining({ status: 'paused', phase: 'focus', taskId: null })])
  })

  test('does nothing when the deleted task is not bound to the current focus session', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    await service.start({ phase: 'focus', taskId: 'task-1' })
    const published: Array<ReturnType<TimerService['getSnapshot']>> = []
    const unsubscribe = service.onSnapshot((snapshot) => {
      published.push(snapshot)
    })

    await service.clearDeletedTaskBinding('task-2')
    unsubscribe()

    expect(service.getSnapshot().taskId).toBe('task-1')
    expect(repos.sessions[0].taskId).toBe('task-1')
    expect(published).toEqual([])
  })

  test('rejects binding when the current timer is not a running focus session', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()

    await expect(service.bindCurrentTask('task-2')).rejects.toThrow('Current timer is not a running focus session')
    expect(repos.sessions).toHaveLength(0)
  })

  test('rejects binding when target task is not active', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    await service.start({ phase: 'focus', taskId: 'task-1' })

    await expect(service.bindCurrentTask('deleted-task')).rejects.toThrow('Selected task must be active')
    expect(repos.sessions[0].taskId).toBe('task-1')
  })

  test('keeps initializing in memory when runtime persistence fails', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService(null)
    repos.runtimeRepository.save = async () => {
      throw new Error('runtime write failed')
    }
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    const snapshot = await service.initialize()

    expect(snapshot.status).toBe('idle')
    expect(snapshot.durationMs).toBe(25 * 60_000)
  })

  test('keeps starting timers when runtime persistence fails', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    repos.runtimeRepository.save = async () => {
      throw new Error('runtime write failed')
    }

    const snapshot = await service.start({ phase: 'focus' })

    expect(snapshot.status).toBe('running')
    expect(snapshot.taskId).toBeNull()
    expect(repos.sessions).toHaveLength(1)
  })

  test('keeps completing timers when runtime persistence fails on tick', async () => {
    const clock = new FakeClock('2026-04-25T09:00:00.000Z')
    const repos = makeRepositories()
    const selection = createSelectionService('task-1')
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    await service.start({ phase: 'focus' })
    repos.runtimeRepository.save = async () => {
      throw new Error('runtime write failed')
    }
    clock.set('2026-04-25T09:25:00.000Z')

    const snapshot = await service.tick()

    expect(snapshot.status).toBe('completed')
    expect(repos.sessions[0].completed).toBe(true)
    expect(repos.sessions[0].completionReason).toBe('completed')
  })

  test('reset clears unbound display count and last task context', async () => {
    const clock = new FakeClock('2026-04-25T09:10:00.000Z')
    const repos = makeRepositories(
      createSession({
        id: 'session-1',
        phase: 'focus',
        taskId: 'task-1',
        startedAt: '2026-04-25T09:00:00.000Z',
        durationMs: 25 * 60_000
      })
    )
    const selection = createSelectionService('task-1')
    await repos.runtimeRepository.save({
      status: 'paused',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: null,
      targetEndAt: null,
      durationMs: 25 * 60_000,
      remainingMs: 15 * 60_000,
      focusCount: 4,
      sessionId: 'session-1',
      updatedAt: new Date('2026-04-25T09:10:00.000Z').getTime(),
      unboundFocusCount: 2,
      lastFocusTaskId: 'task-1'
    } as TimerState)
    const service = new TimerService({
      sessions: repos.sessionRepository,
      settings: repos.settingsRepository,
      runtime: repos.runtimeRepository,
      events: repos.eventRepository,
      tasks: selection,
      clock,
      notifier: { showTimerFinished: async () => undefined },
      sound: { playTimerFinished: async () => undefined }
    })

    await service.initialize()
    const snapshot = readExtendedTimerState(await service.reset())

    expect(snapshot.status).toBe('idle')
    expect(snapshot.unboundFocusCount).toBe(0)
    expect(snapshot.lastFocusTaskId).toBeNull()
  })
})
