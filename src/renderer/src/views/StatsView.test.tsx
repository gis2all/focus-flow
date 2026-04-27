import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { CalendarDayStats, FocusStats, MonthStats } from '@shared/types'
import { StatsView, getHourBarHeight, getRankBarWidth } from './StatsView'

type StatsWithUnboundFocus = FocusStats & { unboundFocusMinutes: number }

const createStats = (input: Partial<StatsWithUnboundFocus> = {}): StatsWithUnboundFocus => ({
  today: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    completedPomodoros: 1,
    completedTasks: 1
  },
  hourlyFocusMinutes: Array.from({ length: 24 }, () => 0),
  weeklyTrend: [],
  taskFocusMinutes: [],
  unboundFocusMinutes: 0,
  ...input
})

const localDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const createCalendarDays = (year: number, month: number): CalendarDayStats[] => {
  const dayCount = new Date(year, month, 0).getDate()
  return Array.from({ length: dayCount }, (_, index) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
    return {
      date,
      focusMinutes: 0,
      completedPomodoros: 0,
      completedTasks: 0,
      shortBreakMinutes: 0,
      longBreakMinutes: 0,
      isFuture: false,
      taskFocusMinutes: [],
      unboundFocusMinutes: 0
    }
  })
}

const createMonthStats = (input: Partial<MonthStats> = {}): MonthStats => ({
  year: 2026,
  month: 4,
  summary: {
    focusMinutes: 0,
    completedPomodoros: 0,
    completedTasks: 0,
    shortBreakMinutes: 0,
    longBreakMinutes: 0
  },
  days: createCalendarDays(2026, 4),
  maxFocusMinutes: 0,
  ...input
})

const noop = (): void => undefined

const renderStatsView = (
  stats: FocusStats = createStats(),
  input: Partial<Parameters<typeof StatsView>[0]> = {}
): string => {
  const props = {
    activeStatsTab: 'today',
    canGoToNextMonth: false,
    monthStats: createMonthStats(),
    onCalendarDaySelect: noop,
    onCalendarMonthChange: noop,
    onStatsTabChange: noop,
    selectedCalendarDate: localDateKey(new Date()),
    stats,
    ...input
  } as Parameters<typeof StatsView>[0]

  return renderToStaticMarkup(<StatsView {...props} />)
}

describe('StatsView', () => {
  test('renders top summary cards and actual break totals', () => {
    const html = renderStatsView(createStats())

    expect(html).toContain('aria-label="统计时间范围"')
    expect(html).toContain('data-summary-surface="white-card"')
    expect(html).toContain('data-summary-icon="focus"')
    expect(html).toContain('data-summary-icon="pomodoros"')
    expect(html).toContain('data-summary-icon="tasks"')
    expect(html).toContain('data-summary-icon="breaks"')
    expect(html.match(/data-summary-surface="white-card"/g)?.length).toBe(4)
    expect(html).toContain('专注时长')
    expect(html).toContain('专注时长分布')
    expect(html).toContain('完成番茄')
    expect(html).toContain('今日已完成')
    expect(html).toContain('任务完成数')
    expect(html).toContain('休息时长')
    expect(html).toContain('今日短休 + 长休')
    expect(html).toContain('>00<')
    expect(html).toContain('>24<')
    expect(html).toContain('left:0%')
    expect(html).toContain('left:100%')
    expect(html).toContain('20m')
    expect(html).toContain('短休息')
    expect(html).toContain('5m')
    expect(html).toContain('长休息')
    expect(html).toContain('15m')
  })

  test('renders all ranked task duration rows, sorts unbound focus in order, and shows y-axis ticks', () => {
    const html = renderStatsView(
      createStats({
          hourlyFocusMinutes: [0, 25, 50, ...Array.from({ length: 21 }, () => 0)],
          taskFocusMinutes: [
            {
              taskId: 'task-a',
              title: '任务 A',
              minutes: 75,
              status: 'completed'
            },
            {
              taskId: 'task-b',
              title: '任务 B',
              minutes: 25,
              status: 'completed'
            },
            {
              taskId: 'task-c',
              title: '任务 C',
              minutes: 18,
              status: 'completed'
            },
            {
              taskId: 'task-d',
              title: '任务 D',
              minutes: 12,
              status: 'completed'
            },
            {
              taskId: 'task-e',
              title: '任务 E',
              minutes: 8,
              status: 'completed'
            },
            {
              taskId: 'task-f',
              title: '任务 F',
              minutes: 5,
              status: 'completed'
            }
          ],
          unboundFocusMinutes: 30
        })
    )

    expect(html).toContain('专注时长')
    expect(html).toContain('已完成任务 + 未绑定专注')
    expect(html).toContain('峰值 50m')
    expect(html).toContain('aria-label="专注时长分布刻度"><span>50m</span><span>25m</span><span>0m</span>')
    expect(html).toContain('任务 A')
    expect(html).toContain('1h 15m')
    expect(html).toContain('25m')
    expect(html).toContain('0')
    expect(html).toContain('任务 B')
    expect(html).toContain('任务 C')
    expect(html).toContain('任务 D')
    expect(html).toContain('任务 E')
    expect(html).toContain('任务 F')
    expect(html).toContain('data-rank-kind="task"')
    expect(html).toContain('data-rank-kind="unbound"')
    expect(html).toContain('未绑定专注')
    expect(html).toContain('30m')
    expect(html).toContain('5m')
    expect(html).not.toContain('进行中')
    expect(html).not.toContain('今日任务总时长')
    expect(html).not.toContain('已完成任务时长')
    expect(html).not.toContain('进行中任务时长')
    expect(html).not.toContain('已删除任务')
    expect(html).toContain('25m')

    const taskAIndex = html.indexOf('>任务 A<')
    const unboundIndex = html.indexOf('>未绑定专注<')
    const taskBIndex = html.indexOf('>任务 B<')

    expect(taskAIndex).toBeGreaterThanOrEqual(0)
    expect(unboundIndex).toBeGreaterThan(taskAIndex)
    expect(taskBIndex).toBeGreaterThan(unboundIndex)
  })

  test('renders a clear focus-duration empty state when tasks and unbound focus are both empty', () => {
    const html = renderStatsView(createStats({ taskFocusMinutes: [], unboundFocusMinutes: 0 }))

    expect(html).toContain('今天还没有专注时长记录')
  })

  test('hides empty hourly bars instead of rendering misleading minimum columns', () => {
    expect(getHourBarHeight(0, 30)).toBe('0%')
    expect(getHourBarHeight(15, 30)).toBe('50%')
  })

  test('scales task ranking bars by the largest task total', () => {
    expect(getRankBarWidth(0, 50)).toBe('0%')
    expect(getRankBarWidth(25, 50)).toBe('50%')
  })

  test('renders the calendar tab with monthly summary cards, monday-first grid, heat levels, and disabled next month', () => {
    const days = createCalendarDays(2026, 4)
    days[0] = { ...days[0], focusMinutes: 20, completedPomodoros: 1, completedTasks: 1, shortBreakMinutes: 5 }
    days[9] = { ...days[9], focusMinutes: 80, completedPomodoros: 3, completedTasks: 2, longBreakMinutes: 15 }
    days[25] = { ...days[25], isFuture: true }
    const html = renderStatsView(createStats(), {
      activeStatsTab: 'calendar',
      canGoToNextMonth: false,
      monthStats: createMonthStats({
        summary: {
          focusMinutes: 100,
          completedPomodoros: 4,
          completedTasks: 3,
          shortBreakMinutes: 5,
          longBreakMinutes: 15
        },
        days,
        maxFocusMinutes: 80
      })
    })

    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('日历')
    expect(html).not.toContain('周视图')
    expect(html).toContain('2026年 4月')
    expect(html).not.toContain('专注日历')
    expect(html).toContain('本月累计')
    expect(html).toContain('1h 40m')
    expect(html).toContain('data-calendar-weekday="0">一')
    expect(html).toContain('data-calendar-weekday="6">日')
    expect(html.match(/data-calendar-placeholder="true"/g)?.length).toBe(5)
    expect(html).toContain('data-calendar-date="2026-04-01"')
    expect(html).toContain('data-heat-level="1"')
    expect(html).toContain('data-calendar-date="2026-04-10"')
    expect(html).toContain('data-heat-level="4"')
    expect(html).toContain('data-calendar-date="2026-04-26"')
    expect(html).toContain('data-calendar-future="true"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('data-calendar-tooltip-metric="focus"')
    expect(html).toContain('data-calendar-tooltip-icon="focus"')
    expect(html).toContain('data-calendar-tooltip-value="focus">1h 20m<')
    expect(html).toContain('data-calendar-tooltip-metric="pomodoros"')
    expect(html).toContain('data-calendar-tooltip-icon="pomodoros"')
    expect(html).toContain('data-calendar-tooltip-value="pomodoros">3<')
    expect(html).toContain('data-calendar-tooltip-metric="tasks"')
    expect(html).toContain('data-calendar-tooltip-icon="tasks"')
    expect(html).toContain('data-calendar-tooltip-value="tasks">2<')
    expect(html).toContain('data-calendar-tooltip-metric="rest"')
    expect(html).toContain('data-calendar-tooltip-icon="rest"')
    expect(html).toContain('data-calendar-tooltip-value="rest">15m<')
  })

  test('renders today focus duration rows below the calendar by default', () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const todayKey = localDateKey(now)
    const todayIndex = now.getDate() - 1
    const days = createCalendarDays(year, month)
    days[todayIndex] = {
      ...days[todayIndex],
      focusMinutes: 55,
      completedPomodoros: 3,
      taskFocusMinutes: [{ taskId: 'today-task', title: '今日任务', minutes: 20, status: 'completed' }],
      unboundFocusMinutes: 35
    }

    const html = renderStatsView(
      createStats({
        taskFocusMinutes: [{ taskId: 'today-task', title: '今日任务', minutes: 20, status: 'completed' }],
        unboundFocusMinutes: 35
      }),
      {
        activeStatsTab: 'calendar',
        monthStats: createMonthStats({
          year,
          month,
          days,
          maxFocusMinutes: 55
        }),
        selectedCalendarDate: todayKey
      }
    )

    expect(html).toContain(`${todayKey.slice(5)} 专注时长`)
    expect(html).toContain('已完成任务 + 未绑定专注')
    expect(html).toContain('本月已完成')
    expect(html).toContain('本月短休 + 长休')
    expect(html).not.toContain('当日专注时长')
    expect(html).toContain(`data-calendar-date="${todayKey}"`)
    expect(html).toContain('data-calendar-selected="true"')
    expect(html).toContain('未绑定专注')
    expect(html).toContain('35m')
    expect(html).toContain('今日任务')
    expect(html).toContain('20m')

    const unboundIndex = html.indexOf('>未绑定专注<')
    const taskIndex = html.indexOf('>今日任务<')

    expect(unboundIndex).toBeGreaterThanOrEqual(0)
    expect(taskIndex).toBeGreaterThan(unboundIndex)
  })

  test('renders selected day focus duration rows and a non-today empty state', () => {
    const days = createCalendarDays(2026, 4)
    days[9] = {
      ...days[9],
      focusMinutes: 120,
      completedPomodoros: 4,
      taskFocusMinutes: [
        { taskId: 'task-a', title: '选中任务 A', minutes: 80, status: 'completed' },
        { taskId: 'task-b', title: '选中任务 B', minutes: 10, status: 'completed' }
      ],
      unboundFocusMinutes: 30
    }
    const html = renderStatsView(createStats(), {
      activeStatsTab: 'calendar',
      monthStats: createMonthStats({ days, maxFocusMinutes: 120 }),
      selectedCalendarDate: '2026-04-10'
    })

    expect(html).toContain('04-10 专注时长')
    expect(html).toContain('已完成任务 + 未绑定专注')
    expect(html).toContain('data-calendar-date="2026-04-10"')
    expect(html).toContain('data-calendar-selected="true"')
    expect(html).not.toContain('data-calendar-tooltip-date="2026-04-10"')
    expect(html).toContain('选中任务 A')
    expect(html).toContain('1h 20m')
    expect(html).toContain('未绑定专注')
    expect(html).toContain('30m')
    expect(html).toContain('选中任务 B')
    expect(html).toContain('10m')

    const taskAIndex = html.indexOf('>选中任务 A<')
    const unboundIndex = html.indexOf('>未绑定专注<')
    const taskBIndex = html.indexOf('>选中任务 B<')

    expect(taskAIndex).toBeGreaterThanOrEqual(0)
    expect(unboundIndex).toBeGreaterThan(taskAIndex)
    expect(taskBIndex).toBeGreaterThan(unboundIndex)

    const emptyHtml = renderStatsView(createStats(), {
      activeStatsTab: 'calendar',
      monthStats: createMonthStats({ days, maxFocusMinutes: 120 }),
      selectedCalendarDate: '2026-04-11'
    })

    expect(emptyHtml).toContain('这一天还没有专注时长记录')
  })

  test('marks today in the calendar when the selected month contains the local current day', () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const todayIndex = now.getDate() - 1
    const days = createCalendarDays(year, month)
    days[todayIndex] = { ...days[todayIndex], focusMinutes: 25, completedPomodoros: 1 }

    const html = renderStatsView(createStats(), {
      activeStatsTab: 'calendar',
      canGoToNextMonth: false,
      monthStats: createMonthStats({
        year,
        month,
        days,
        maxFocusMinutes: 25
      })
    })

    expect(html).toContain('data-calendar-today="true"')
    expect(html).toContain('data-calendar-today-dot="true"')
    expect(html).toContain('data-calendar-today-label="true">今<')
  })
})
