import { describe, expect, test, vi } from 'vitest'
import type { Task } from '@shared/types'
import type { TaskRepository } from '@main/ports/repositories'
import { TaskService } from './taskService'

const task = (input: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({
  sortOrder: 1,
  completedAt: null,
  createdAt: '2026-04-25T09:00:00.000Z',
  updatedAt: '2026-04-25T09:00:00.000Z',
  ...input
})

const createRepository = (): TaskRepository => ({
  list: async () => [],
  create: async (title) => task({ id: 'task-1', title }),
  updateTitle: async (id, title) => task({ id, title }),
  complete: async (id) => task({ id, title: 'Done', completedAt: '2026-04-25T10:00:00.000Z', sortOrder: 0 }),
  restore: async (id) => task({ id, title: 'Restored', sortOrder: 2 }),
  reorderActive: vi.fn(async () => undefined),
  delete: async () => undefined,
  countCompletedOn: async () => 0
})

describe('TaskService', () => {
  test('trims task titles when creating and updating', async () => {
    const repository = createRepository()
    const service = new TaskService(repository)

    await expect(service.create('  Write docs  ')).resolves.toMatchObject({ title: 'Write docs' })
    await expect(service.update('task-1', '  Refine copy  ')).resolves.toMatchObject({ title: 'Refine copy' })
  })

  test('rejects blank task titles', async () => {
    const repository = createRepository()
    const service = new TaskService(repository)

    expect(() => service.create('   ')).toThrow('Task title is required')
    expect(() => service.update('task-1', '   ')).toThrow('Task title is required')
  })

  test('rejects duplicate ids in reorder payloads', async () => {
    const repository = createRepository()
    const service = new TaskService(repository)

    expect(() => service.reorder(['task-1', 'task-1'])).toThrow('Task reorder payload contains duplicate ids')
  })
})
