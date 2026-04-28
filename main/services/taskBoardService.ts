import type { TaskBoardItem, TaskBoardSnapshot } from '@shared/types'
import type { TaskRepository, TimerSessionRepository } from '@main/ports/repositories'

const buildTaskBoardItem = (
  task: Awaited<ReturnType<TaskRepository['list']>>[number],
  metrics: { focusMinutes: number; completedPomodoros: number }
): TaskBoardItem => ({
  id: task.id,
  title: task.title,
  sortOrder: task.sortOrder,
  completedAt: task.completedAt,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  focusMinutes: metrics.focusMinutes,
  completedPomodoros: metrics.completedPomodoros
})

export class TaskBoardService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly sessions: TimerSessionRepository
  ) {}

  async get(): Promise<TaskBoardSnapshot> {
    const [tasks, sessions] = await Promise.all([this.tasks.list(), this.sessions.list()])
    const metricsByTaskId = new Map<string, { focusMinutes: number; completedPomodoros: number }>()

    for (const session of sessions) {
      if (session.phase !== 'focus' || !session.completed || !session.taskId) continue
      const entry = metricsByTaskId.get(session.taskId) ?? { focusMinutes: 0, completedPomodoros: 0 }
      entry.focusMinutes += Math.round((session.actualDurationMs ?? 0) / 60_000)
      entry.completedPomodoros += 1
      metricsByTaskId.set(session.taskId, entry)
    }

    const activeItems = tasks
      .filter((task) => !task.completedAt)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt))
      .map((task) => buildTaskBoardItem(task, metricsByTaskId.get(task.id) ?? { focusMinutes: 0, completedPomodoros: 0 }))

    const completedItems = tasks
      .filter((task) => Boolean(task.completedAt))
      .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))
      .map((task) => buildTaskBoardItem(task, metricsByTaskId.get(task.id) ?? { focusMinutes: 0, completedPomodoros: 0 }))

    return {
      counts: {
        all: tasks.length,
        active: activeItems.length,
        completed: completedItems.length
      },
      activeItems,
      completedItems
    }
  }
}
