import type { Task } from '@shared/types'
import type { TaskRepository } from '@main/ports/repositories'

export class TaskService {
  constructor(private readonly tasks: TaskRepository) {}

  list(): Promise<Task[]> {
    return this.tasks.list()
  }

  create(title: string): Promise<Task> {
    const trimmed = title.trim()
    if (!trimmed) throw new Error('Task title is required')
    return this.tasks.create(trimmed)
  }

  update(id: string, title: string): Promise<Task> {
    const trimmed = title.trim()
    if (!trimmed) throw new Error('Task title is required')
    return this.tasks.updateTitle(id, trimmed)
  }

  complete(id: string): Promise<Task> {
    return this.tasks.complete(id)
  }

  restore(id: string): Promise<Task> {
    return this.tasks.restore(id)
  }

  reorder(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length !== ids.length) {
      throw new Error('Task reorder payload contains duplicate ids')
    }
    return this.tasks.reorderActive(ids)
  }

  delete(id: string): Promise<void> {
    return this.tasks.delete(id)
  }
}
