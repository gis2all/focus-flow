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

export class StatsService {
  constructor(
    private readonly sessions: TimerSessionRepository,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort
  ) {}

  async get(): Promise<FocusStats> {
    const now = new Date(this.clock.now())
    return aggregateStats({
      now,
      sessions: await this.sessions.list(),
      completedTasks: await this.tasks.countCompletedOn(localDateKey(now))
    })
  }
}
