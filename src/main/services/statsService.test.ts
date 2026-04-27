import { describe, expect, test } from 'vitest'
import type { ClockPort } from '@main/ports/desktop'
import type { TaskRepository, TimerSessionRepository } from '@main/ports/repositories'
import type { MonthStats, Task, TimerSession } from '@shared/types'
import { StatsService } from './statsService'

class FakeClock implements ClockPort {
  constructor(private readonly value: number) {}

  now(): number {
    return this.value
  }

  nowIso(): string {
    return new Date(this.value).toISOString()
  }
}

const task = (input: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({
  sortOrder: 1,
  completedAt: null,
  createdAt: '2026-04-24T08:00:00.000Z',
  updatedAt: '2026-04-24T08:00:00.000Z',
  ...input
})

const session = (input: Partial<TimerSession> & Pick<TimerSession, 'id' | 'startedAt' | 'phase'>): TimerSession => ({
  taskId: null,
  endedAt: null,
  durationMs: 25 * 60_000,
  actualDurationMs: 25 * 60_000,
  completed: true,
  completionReason: 'completed',
  createdAt: input.startedAt,
  updatedAt: input.startedAt,
  ...input
})

describe('StatsService', () => {
  test('counts completed tasks by local day instead of UTC date prefixes', async () => {
    const sessions: TimerSessionRepository = {
      list: async () => [],
      create: async () => {
        throw new Error('not used')
      },
      finish: async () => {
        throw new Error('not used')
      },
      updateTask: async () => {
        throw new Error('not used')
      },
      findActive: async () => null
    }
    const tasks: TaskRepository = {
      list: async () => [
        task({ id: 'task-1', title: 'Task 1', completedAt: '2026-04-24T16:30:00.000Z' }),
        task({ id: 'task-2', title: 'Task 2', completedAt: '2026-04-25T14:00:00.000Z' }),
        task({ id: 'task-3', title: 'Task 3', completedAt: '2026-04-24T14:00:00.000Z' })
      ],
      create: async () => {
        throw new Error('not used')
      },
      updateTitle: async () => {
        throw new Error('not used')
      },
      complete: async () => {
        throw new Error('not used')
      },
      restore: async () => {
        throw new Error('not used')
      },
      reorderActive: async () => {
        throw new Error('not used')
      },
      delete: async () => {
        throw new Error('not used')
      },
      countCompletedOn: async () => 999
    }
    const service = new StatsService(sessions, tasks, new FakeClock(new Date('2026-04-25T12:00:00+08:00').getTime()))

    const stats = await service.get()

    expect(stats.today.completedTasks).toBe(2)
  })

  test('returns month stats for the requested year and month', async () => {
    const sessions: TimerSessionRepository = {
      list: async () => [
        session({
          id: 'april-focus',
          phase: 'focus',
          taskId: 'april-task',
          startedAt: '2026-04-10T10:00:00.000+08:00',
          actualDurationMs: 25 * 60_000
        }),
        session({
          id: 'april-unbound-focus',
          phase: 'focus',
          startedAt: '2026-04-10T11:00:00.000+08:00',
          actualDurationMs: 10 * 60_000
        }),
        session({
          id: 'may-focus',
          phase: 'focus',
          startedAt: '2026-05-10T10:00:00.000+08:00',
          actualDurationMs: 50 * 60_000
        })
      ],
      create: async () => {
        throw new Error('not used')
      },
      finish: async () => {
        throw new Error('not used')
      },
      updateTask: async () => {
        throw new Error('not used')
      },
      findActive: async () => null
    }
    const tasks: TaskRepository = {
      list: async () => [task({ id: 'april-task', title: 'April Task', completedAt: '2026-04-10T12:00:00.000+08:00' })],
      create: async () => {
        throw new Error('not used')
      },
      updateTitle: async () => {
        throw new Error('not used')
      },
      complete: async () => {
        throw new Error('not used')
      },
      restore: async () => {
        throw new Error('not used')
      },
      reorderActive: async () => {
        throw new Error('not used')
      },
      delete: async () => {
        throw new Error('not used')
      },
      countCompletedOn: async () => 999
    }
    const service = new StatsService(sessions, tasks, new FakeClock(new Date('2026-04-25T12:00:00+08:00').getTime()))

    const monthStats = (await service.getMonth({ year: 2026, month: 4 })) as MonthStats

    expect(monthStats.summary.focusMinutes).toBe(35)
    expect(monthStats.summary.completedPomodoros).toBe(2)
    expect(monthStats.summary.completedTasks).toBe(1)
    expect(monthStats.days).toHaveLength(30)
    expect(monthStats.days[9].date).toBe('2026-04-10')
    expect(monthStats.days[9].focusMinutes).toBe(35)
    expect(monthStats.days[9].unboundFocusMinutes).toBe(10)
    expect(monthStats.days[9].taskFocusMinutes).toEqual([
      { taskId: 'april-task', title: 'April Task', minutes: 25, status: 'completed' }
    ])
  })
})
