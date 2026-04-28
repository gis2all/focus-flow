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

const createRepository = (items: Task[] = []): TaskRepository => {
  const tasks = [...items]
  return {
    list: async () => tasks.map((item) => ({ ...item })),
    create: async (title) => {
      const created = task({
        id: `task-${tasks.length + 1}`,
        title,
        sortOrder: tasks.filter((item) => !item.completedAt).length + 1
      })
      tasks.push(created)
      return created
    },
    updateTitle: async (id, title) => {
      const current = tasks.find((item) => item.id === id)
      if (!current) throw new Error('missing task')
      current.title = title
      return current
    },
    complete: async (id) => {
      const current = tasks.find((item) => item.id === id)
      if (!current) throw new Error('missing task')
      current.completedAt = '2026-04-25T10:00:00.000Z'
      current.sortOrder = 0
      return current
    },
    restore: async (id) => {
      const current = tasks.find((item) => item.id === id)
      if (!current) throw new Error('missing task')
      current.completedAt = null
      current.sortOrder = tasks.filter((item) => !item.completedAt).length + 1
      return current
    },
    reorderActive: vi.fn(async (ids: string[]) => {
      ids.forEach((id: string, index: number) => {
        const current = tasks.find((item) => item.id === id)
        if (current) current.sortOrder = index + 1
      })
    }),
    delete: async (id) => {
      const index = tasks.findIndex((item) => item.id === id)
      if (index >= 0) tasks.splice(index, 1)
    }
  }
}

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

    await expect(service.create('   ')).rejects.toThrow('Task title is required')
    expect(() => service.update('task-1', '   ')).toThrow('Task title is required')
  })

  test('rejects duplicate ids in reorder payloads', async () => {
    const repository = createRepository()
    const service = new TaskService(repository)

    expect(() => service.reorder(['task-1', 'task-1'])).toThrow('Task reorder payload contains duplicate ids')
  })

  test('completes and deletes tasks without maintaining selection state', async () => {
    const repository = createRepository([
      task({ id: 'task-a', title: 'Task A', sortOrder: 1 }),
      task({ id: 'task-b', title: 'Task B', sortOrder: 2 }),
      task({ id: 'task-c', title: 'Task C', sortOrder: 3 })
    ])
    const service = new TaskService(repository)

    await service.complete('task-b')
    expect((await repository.list()).find((item) => item.id === 'task-b')?.completedAt).toBeTruthy()

    await service.delete('task-c')
    expect((await repository.list()).map((item) => item.id)).toEqual(['task-a', 'task-b'])
  })
})
