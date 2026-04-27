import type { FocusStats, Task, TimerSession } from '@shared/types'

export interface AggregateStatsInput {
  now: Date
  sessions: TimerSession[]
  tasks?: Task[]
  completedTasks?: number
}

const localDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startOfLocalDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const minutesFromMs = (value: number | null): number => Math.round((value ?? 0) / 60_000)

export const aggregateStats = (input: AggregateStatsInput): FocusStats => {
  const completedFocusSessions = input.sessions.filter((session) => session.phase === 'focus' && session.completed)
  const completedShortBreakSessions = input.sessions.filter((session) => session.phase === 'shortBreak' && session.completed)
  const completedLongBreakSessions = input.sessions.filter((session) => session.phase === 'longBreak' && session.completed)
  const todayKey = localDateKey(input.now)
  const hourlyFocusMinutes = Array.from({ length: 24 }, () => 0)
  const taskTotals = new Map<string, number>()
  const tasksById = new Map((input.tasks ?? []).map((task) => [task.id, task]))
  const weeklyBuckets = new Map<string, { focusMinutes: number; completedPomodoros: number }>()

  for (let index = 6; index >= 0; index -= 1) {
    const day = startOfLocalDay(input.now)
    day.setDate(day.getDate() - index)
    weeklyBuckets.set(localDateKey(day), { focusMinutes: 0, completedPomodoros: 0 })
  }

  let todayFocusMinutes = 0
  let todayShortBreakMinutes = 0
  let todayLongBreakMinutes = 0
  let todayCompletedPomodoros = 0

  for (const session of completedFocusSessions) {
    const started = new Date(session.startedAt)
    const dateKey = localDateKey(started)
    const minutes = minutesFromMs(session.actualDurationMs)

    if (dateKey === todayKey) {
      todayFocusMinutes += minutes
      todayCompletedPomodoros += 1
      hourlyFocusMinutes[started.getHours()] += minutes
    }

    const weeklyBucket = weeklyBuckets.get(dateKey)
    if (weeklyBucket) {
      weeklyBucket.focusMinutes += minutes
      weeklyBucket.completedPomodoros += 1
    }

    if (dateKey === todayKey && session.taskId) {
      const task = tasksById.get(session.taskId)
      if (!task?.completedAt || localDateKey(new Date(task.completedAt)) !== todayKey) continue
      taskTotals.set(session.taskId, (taskTotals.get(session.taskId) ?? 0) + minutes)
    }
  }

  for (const session of completedShortBreakSessions) {
    const started = new Date(session.startedAt)
    if (localDateKey(started) === todayKey) {
      todayShortBreakMinutes += minutesFromMs(session.actualDurationMs)
    }
  }

  for (const session of completedLongBreakSessions) {
    const started = new Date(session.startedAt)
    if (localDateKey(started) === todayKey) {
      todayLongBreakMinutes += minutesFromMs(session.actualDurationMs)
    }
  }

  return {
    today: {
      focusMinutes: todayFocusMinutes,
      shortBreakMinutes: todayShortBreakMinutes,
      longBreakMinutes: todayLongBreakMinutes,
      completedPomodoros: todayCompletedPomodoros,
      completedTasks: input.completedTasks ?? 0
    },
    hourlyFocusMinutes,
    weeklyTrend: Array.from(weeklyBuckets.entries()).map(([date, value]) => ({
      date,
      ...value
    })),
    taskFocusMinutes: Array.from(taskTotals.entries())
      .map(([taskId, minutes]) => {
        const task = tasksById.get(taskId)!
        return {
          taskId,
          title: task.title,
          minutes,
          status: 'completed' as const
        }
      })
      .sort((left, right) => right.minutes - left.minutes)
  }
}
