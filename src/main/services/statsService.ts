import { aggregateStats } from '@core/stats/statsAggregator'
import type { FocusStats } from '@shared/types'
import type { ClockPort } from '@main/ports/desktop'
import type { TaskRepository, TimerSessionRepository } from '@main/ports/repositories'

const localDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const countCompletedTasksForLocalDay = (
  tasks: Awaited<ReturnType<TaskRepository['list']>>,
  now: Date
): number =>
  tasks.filter((task) => task.completedAt && localDateKey(new Date(task.completedAt)) === localDateKey(now)).length

export class StatsService {
  constructor(
    private readonly sessions: TimerSessionRepository,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort
  ) {}

  async get(): Promise<FocusStats> {
    const now = new Date(this.clock.now())
    const tasks = await this.tasks.list()
    return aggregateStats({
      now,
      sessions: await this.sessions.list(),
      completedTasks: countCompletedTasksForLocalDay(tasks, now)
    })
  }
}
