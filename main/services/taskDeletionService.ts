import type { TaskRepository, TimerSessionRepository, TransactionRunner } from '@main/ports/repositories'
import type { TimerService } from './timerService'

export interface TaskDeletionServiceDependencies {
  tasks: Pick<TaskRepository, 'list' | 'delete'>
  sessions: Pick<TimerSessionRepository, 'deleteHistoricalFocusByTaskId'>
  timer: Pick<TimerService, 'clearDeletedTaskBinding'>
  transactions: TransactionRunner
}

export class TaskDeletionService {
  constructor(private readonly dependencies: TaskDeletionServiceDependencies) {}

  async delete(taskId: string): Promise<void> {
    await this.dependencies.transactions.transaction(async () => {
      const taskExists = (await this.dependencies.tasks.list()).some((task) => task.id === taskId)
      if (!taskExists) {
        throw new Error(`Task not found: ${taskId}`)
      }

      await this.dependencies.timer.clearDeletedTaskBinding(taskId)
      await this.dependencies.sessions.deleteHistoricalFocusByTaskId(taskId)
      await this.dependencies.tasks.delete(taskId)
    })
  }
}
