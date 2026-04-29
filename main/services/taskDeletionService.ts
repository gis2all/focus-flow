import type { TaskRepository, TimerSessionRepository } from '@main/ports/repositories'
import type { TimerService } from './timerService'

export interface TaskDeletionServiceDependencies {
  tasks: Pick<TaskRepository, 'list' | 'delete'>
  sessions: Pick<TimerSessionRepository, 'deleteHistoricalFocusByTaskId'>
  timer: Pick<TimerService, 'clearDeletedTaskBinding'>
}

export class TaskDeletionService {
  constructor(private readonly dependencies: TaskDeletionServiceDependencies) {}

  async delete(taskId: string): Promise<void> {
    const taskExists = (await this.dependencies.tasks.list()).some((task) => task.id === taskId)
    if (!taskExists) {
      throw new Error(`Task not found: ${taskId}`)
    }

    await this.dependencies.timer.clearDeletedTaskBinding(taskId)
    await this.dependencies.sessions.deleteHistoricalFocusByTaskId(taskId)
    await this.dependencies.tasks.delete(taskId)
  }
}
