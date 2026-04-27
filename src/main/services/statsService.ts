import { aggregateMonthStats, aggregateStats } from '@core/stats/statsAggregator'
import type { MonthStatsRequest } from '@shared/contracts'
import type { FocusStats, MonthStats } from '@shared/types'
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
      tasks,
      sessions: await this.sessions.list(),
      completedTasks: countCompletedTasksForLocalDay(tasks, now)
    })
  }

  async getMonth(request: MonthStatsRequest): Promise<MonthStats> {
    const tasks = await this.tasks.list()
    return aggregateMonthStats({
      now: new Date(this.clock.now()),
      year: request.year,
      month: request.month,
      tasks,
      sessions: await this.sessions.list()
    })
  }
}
