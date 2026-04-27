import type {
  CalendarDayStats,
  FocusStats,
  MonthStats,
  MonthStatsSummary,
  Task,
  TaskFocusPoint,
  TimerSession
} from '@shared/types'

export interface AggregateStatsInput {
  now: Date
  sessions: TimerSession[]
  tasks?: Task[]
  completedTasks?: number
}

export interface AggregateMonthStatsInput {
  now: Date
  year: number
  month: number
  sessions: TimerSession[]
  tasks?: Task[]
}

const localDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startOfLocalDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const minutesFromMs = (value: number | null): number => Math.round((value ?? 0) / 60_000)

const createEmptyMonthSummary = (): MonthStatsSummary => ({
  focusMinutes: 0,
  completedPomodoros: 0,
  completedTasks: 0,
  shortBreakMinutes: 0,
  longBreakMinutes: 0
})

const createMonthDayBuckets = (year: number, month: number, now: Date): Map<string, CalendarDayStats> => {
  const dayCount = new Date(year, month, 0).getDate()
  const todayKey = localDateKey(now)
  const buckets = new Map<string, CalendarDayStats>()

  for (let day = 1; day <= dayCount; day += 1) {
    const date = new Date(year, month - 1, day)
    const dateKey = localDateKey(date)
    buckets.set(dateKey, {
      date: dateKey,
      ...createEmptyMonthSummary(),
      isFuture: dateKey > todayKey,
      taskFocusMinutes: [],
      unboundFocusMinutes: 0
    })
  }

  return buckets
}

const buildTaskFocusPoints = (taskTotals: Map<string, number>, tasksById: Map<string, Task>): TaskFocusPoint[] =>
  Array.from(taskTotals.entries())
    .filter(([, minutes]) => minutes > 0)
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
  let todayUnboundFocusMinutes = 0

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

    if (dateKey === todayKey && session.taskId === null) {
      todayUnboundFocusMinutes += minutes
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
      .sort((left, right) => right.minutes - left.minutes),
    unboundFocusMinutes: todayUnboundFocusMinutes
  }
}

export const aggregateMonthStats = (input: AggregateMonthStatsInput): MonthStats => {
  const dayBuckets = createMonthDayBuckets(input.year, input.month, input.now)
  const summary = createEmptyMonthSummary()
  const tasks = input.tasks ?? []
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const dayTaskTotals = new Map<string, Map<string, number>>()
  const todayKey = localDateKey(input.now)

  for (const task of tasks) {
    if (!task.completedAt) continue
    const completedKey = localDateKey(new Date(task.completedAt))
    const day = dayBuckets.get(completedKey)
    if (!day || day.isFuture) continue
    day.completedTasks += 1
    summary.completedTasks += 1
  }

  for (const session of input.sessions) {
    if (!session.completed) continue
    const sessionKey = localDateKey(new Date(session.startedAt))
    const day = dayBuckets.get(sessionKey)
    if (!day || day.isFuture || sessionKey > todayKey) continue

    const minutes = minutesFromMs(session.actualDurationMs)

    if (session.phase === 'focus') {
      day.focusMinutes += minutes
      day.completedPomodoros += 1
      summary.focusMinutes += minutes
      summary.completedPomodoros += 1

      if (session.taskId === null) {
        day.unboundFocusMinutes += minutes
        continue
      }

      const task = tasksById.get(session.taskId)
      if (!task?.completedAt || localDateKey(new Date(task.completedAt)) !== sessionKey) continue

      const taskTotals = dayTaskTotals.get(sessionKey) ?? new Map<string, number>()
      taskTotals.set(session.taskId, (taskTotals.get(session.taskId) ?? 0) + minutes)
      dayTaskTotals.set(sessionKey, taskTotals)
      continue
    }

    if (session.phase === 'shortBreak') {
      day.shortBreakMinutes += minutes
      summary.shortBreakMinutes += minutes
      continue
    }

    if (session.phase === 'longBreak') {
      day.longBreakMinutes += minutes
      summary.longBreakMinutes += minutes
    }
  }

  const days = Array.from(dayBuckets.values())
  for (const day of days) {
    const taskTotals = dayTaskTotals.get(day.date)
    day.taskFocusMinutes = taskTotals ? buildTaskFocusPoints(taskTotals, tasksById) : []
  }

  return {
    year: input.year,
    month: input.month,
    summary,
    days,
    maxFocusMinutes: Math.max(...days.filter((day) => !day.isFuture).map((day) => day.focusMinutes), 0)
  }
}
