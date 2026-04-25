import { describe, expect, test } from 'vitest'
import type { ClockPort } from '@main/ports/desktop'
import type { TaskRepository, TimerSessionRepository } from '@main/ports/repositories'
import type { Task, TimerSession } from '@shared/types'
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
})
