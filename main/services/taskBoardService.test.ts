import { describe, expect, test } from 'vitest'
import type { Task, TimerSession } from '@shared/types'
import type { TaskRepository, TimerSessionRepository } from '@main/ports/repositories'
import { TaskBoardService } from './taskBoardService'

const task = (input: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({
  sortOrder: 1,
  completedAt: null,
  createdAt: '2026-04-25T09:00:00.000Z',
  updatedAt: '2026-04-25T09:00:00.000Z',
  ...input
})

const session = (input: Partial<TimerSession>): TimerSession => ({
  id: input.id ?? 'session-1',
  phase: input.phase ?? 'focus',
  taskId: input.taskId ?? null,
  startedAt: input.startedAt ?? '2026-04-25T09:00:00.000Z',
  endedAt: input.endedAt ?? '2026-04-25T09:25:00.000Z',
  durationMs: input.durationMs ?? 25 * 60_000,
  actualDurationMs: input.actualDurationMs ?? 25 * 60_000,
  completed: input.completed ?? true,
  completionReason: input.completionReason ?? 'completed',
  createdAt: input.createdAt ?? '2026-04-25T09:00:00.000Z',
  updatedAt: input.updatedAt ?? '2026-04-25T09:25:00.000Z'
})

describe('TaskBoardService', () => {
  test('builds task board counts and per-task focus stats', async () => {
    const tasks: TaskRepository = {
      list: async () => [
        task({ id: 'task-a', title: 'Task A', sortOrder: 2 }),
        task({ id: 'task-b', title: 'Task B', sortOrder: 1 }),
        task({ id: 'task-c', title: 'Task C', completedAt: '2026-04-25T11:00:00.000Z', sortOrder: 0 })
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
      }
    }
    const sessions: TimerSessionRepository = {
      list: async () => [
        session({ id: 's1', taskId: 'task-b' }),
        session({ id: 's2', taskId: 'task-b', actualDurationMs: 15 * 60_000 }),
        session({ id: 's3', taskId: 'task-c', actualDurationMs: 30 * 60_000 }),
        session({ id: 's4', taskId: 'task-a', phase: 'shortBreak' }),
        session({ id: 's5', taskId: 'task-a', completed: false })
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
    const service = new TaskBoardService(tasks, sessions)

    const snapshot = await service.get()

    expect(snapshot.counts).toEqual({ all: 3, active: 2, completed: 1 })
    expect(snapshot.activeItems.map((item) => item.id)).toEqual(['task-b', 'task-a'])
    expect(snapshot.activeItems[0]).toMatchObject({ completedPomodoros: 2, focusMinutes: 40 })
    expect(snapshot.completedItems[0]).toMatchObject({ id: 'task-c', completedPomodoros: 1, focusMinutes: 30 })
  })
})
