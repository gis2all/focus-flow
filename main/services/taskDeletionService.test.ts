import { describe, expect, test } from 'vitest'
import type { Task, TimerPhase, TimerSession, TimerSnapshot, TimerStatus } from '@shared/types'
import { TaskDeletionService } from './taskDeletionService'

const createTask = (input: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({
  sortOrder: 1,
  completedAt: null,
  createdAt: '2026-04-25T09:00:00.000Z',
  updatedAt: '2026-04-25T09:00:00.000Z',
  ...input
})

const createSession = (input: Partial<TimerSession> & Pick<TimerSession, 'id' | 'phase' | 'startedAt'>): TimerSession => ({
  taskId: null,
  endedAt: '2026-04-25T09:25:00.000Z',
  durationMs: 25 * 60_000,
  actualDurationMs: 25 * 60_000,
  completed: true,
  completionReason: 'completed',
  createdAt: input.startedAt,
  updatedAt: input.startedAt,
  ...input
})

const createSnapshot = ({
  phase,
  sessionId,
  status,
  taskId
}: {
  phase: TimerPhase
  sessionId: string | null
  status: TimerStatus
  taskId: string | null
}): TimerSnapshot => ({
  status,
  phase,
  taskId,
  startedAt: status === 'running' ? new Date('2026-04-25T09:00:00.000Z').getTime() : null,
  targetEndAt: status === 'running' ? new Date('2026-04-25T09:25:00.000Z').getTime() : null,
  durationMs: phase === 'focus' ? 25 * 60_000 : 5 * 60_000,
  remainingMs: status === 'paused' ? 20 * 60_000 : 25 * 60_000,
  focusCount: 0,
  unboundFocusCount: 0,
  lastFocusTaskId: null,
  sessionId,
  updatedAt: new Date('2026-04-25T09:05:00.000Z').getTime(),
  elapsedMs: status === 'paused' ? 5 * 60_000 : 0,
  progress: status === 'paused' ? 0.2 : 0
})

const createTaskRepository = (items: Task[]) => {
  const tasks = [...items]

  return {
    list: async () => tasks.map((task) => ({ ...task })),
    delete: async (id: string) => {
      const index = tasks.findIndex((task) => task.id === id)
      if (index < 0) throw new Error(`Task not found: ${id}`)
      tasks.splice(index, 1)
    }
  }
}

const createSessionRepository = (items: TimerSession[]) => {
  const sessions = [...items]

  return {
    list: async () => sessions.map((session) => ({ ...session })),
    deleteHistoricalFocusByTaskId: async (taskId: string) => {
      for (let index = sessions.length - 1; index >= 0; index -= 1) {
        if (sessions[index].phase === 'focus' && sessions[index].taskId === taskId) {
          sessions.splice(index, 1)
        }
      }
    }
  }
}

class FakeTimerService {
  constructor(
    private readonly sessions: TimerSession[],
    private snapshot: TimerSnapshot
  ) {}

  async clearDeletedTaskBinding(taskId: string): Promise<void> {
    if (this.snapshot.phase !== 'focus') return
    if (this.snapshot.status !== 'running' && this.snapshot.status !== 'paused') return
    if (this.snapshot.taskId !== taskId || !this.snapshot.sessionId) return

    const activeSession = this.sessions.find((session) => session.id === this.snapshot.sessionId)
    if (!activeSession) return

    activeSession.taskId = null
    this.snapshot = {
      ...this.snapshot,
      taskId: null
    }
  }

  getSnapshot(): TimerSnapshot {
    return this.snapshot
  }
}

describe('TaskDeletionService', () => {
  test('deletes a normal task together with its historical focus records', async () => {
    const taskRepository = createTaskRepository([
      createTask({ id: 'task-1', title: 'Task 1' }),
      createTask({ id: 'task-2', title: 'Task 2' })
    ])
    const sessionRepository = createSessionRepository([
      createSession({ id: 'focus-task-1', phase: 'focus', taskId: 'task-1', startedAt: '2026-04-24T09:00:00.000Z' }),
      createSession({ id: 'focus-task-2', phase: 'focus', taskId: 'task-2', startedAt: '2026-04-24T10:00:00.000Z' })
    ])
    const timer = new FakeTimerService([], createSnapshot({ status: 'idle', phase: 'focus', taskId: null, sessionId: null }))
    const service = new TaskDeletionService({
      tasks: taskRepository,
      sessions: sessionRepository,
      timer
    })

    await service.delete('task-1')

    await expect(taskRepository.list()).resolves.toEqual([expect.objectContaining({ id: 'task-2' })])
    await expect(sessionRepository.list()).resolves.toEqual([expect.objectContaining({ id: 'focus-task-2' })])
  })

  test('unbinds the current running focus session before deleting the task and its history', async () => {
    const taskRepository = createTaskRepository([createTask({ id: 'task-1', title: 'Task 1' })])
    const activeSession = createSession({
      id: 'active-focus',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: '2026-04-25T09:00:00.000Z',
      endedAt: null,
      completed: false,
      actualDurationMs: null,
      completionReason: null
    })
    const historicalSession = createSession({
      id: 'historical-focus',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: '2026-04-24T09:00:00.000Z'
    })
    const otherTaskSession = createSession({
      id: 'other-task-focus',
      phase: 'focus',
      taskId: 'task-2',
      startedAt: '2026-04-24T10:00:00.000Z'
    })
    const sessions = [activeSession, historicalSession, otherTaskSession]
    const sessionRepository = createSessionRepository(sessions)
    const timer = new FakeTimerService(
      sessions,
      createSnapshot({ status: 'running', phase: 'focus', taskId: 'task-1', sessionId: activeSession.id })
    )
    const service = new TaskDeletionService({
      tasks: taskRepository,
      sessions: sessionRepository,
      timer
    })

    await service.delete('task-1')

    expect(timer.getSnapshot()).toEqual(expect.objectContaining({ status: 'running', phase: 'focus', taskId: null }))
    await expect(taskRepository.list()).resolves.toEqual([])
    await expect(sessionRepository.list()).resolves.toEqual([
      expect.objectContaining({ id: 'active-focus', taskId: null }),
      expect.objectContaining({ id: 'other-task-focus', taskId: 'task-2' })
    ])
  })

  test('unbinds the current paused focus session before deleting the task and keeps it paused', async () => {
    const taskRepository = createTaskRepository([createTask({ id: 'task-1', title: 'Task 1' })])
    const activeSession = createSession({
      id: 'paused-focus',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: '2026-04-25T09:00:00.000Z',
      endedAt: null,
      completed: false,
      actualDurationMs: null,
      completionReason: null
    })
    const historicalSession = createSession({
      id: 'historical-focus',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: '2026-04-24T09:00:00.000Z'
    })
    const sessions = [activeSession, historicalSession]
    const sessionRepository = createSessionRepository(sessions)
    const timer = new FakeTimerService(
      sessions,
      createSnapshot({ status: 'paused', phase: 'focus', taskId: 'task-1', sessionId: activeSession.id })
    )
    const service = new TaskDeletionService({
      tasks: taskRepository,
      sessions: sessionRepository,
      timer
    })

    await service.delete('task-1')

    expect(timer.getSnapshot()).toEqual(expect.objectContaining({ status: 'paused', phase: 'focus', taskId: null }))
    await expect(sessionRepository.list()).resolves.toEqual([expect.objectContaining({ id: 'paused-focus', taskId: null })])
  })

  test('leaves the current snapshot unchanged when deleting an unrelated task', async () => {
    const taskRepository = createTaskRepository([
      createTask({ id: 'task-1', title: 'Task 1' }),
      createTask({ id: 'task-2', title: 'Task 2' })
    ])
    const activeSession = createSession({
      id: 'active-focus',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: '2026-04-25T09:00:00.000Z',
      endedAt: null,
      completed: false,
      actualDurationMs: null,
      completionReason: null
    })
    const sessions = [
      activeSession,
      createSession({ id: 'task-2-history', phase: 'focus', taskId: 'task-2', startedAt: '2026-04-24T09:00:00.000Z' })
    ]
    const sessionRepository = createSessionRepository(sessions)
    const timer = new FakeTimerService(
      sessions,
      createSnapshot({ status: 'running', phase: 'focus', taskId: 'task-1', sessionId: activeSession.id })
    )
    const service = new TaskDeletionService({
      tasks: taskRepository,
      sessions: sessionRepository,
      timer
    })

    await service.delete('task-2')

    expect(timer.getSnapshot()).toEqual(expect.objectContaining({ status: 'running', phase: 'focus', taskId: 'task-1' }))
    await expect(sessionRepository.list()).resolves.toEqual([expect.objectContaining({ id: 'active-focus', taskId: 'task-1' })])
  })
})
