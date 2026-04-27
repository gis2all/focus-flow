import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { FocusStats } from '@shared/types'
import { StatsView, getHourBarHeight, getRankBarWidth } from './StatsView'

const createStats = (input: Partial<FocusStats> = {}): FocusStats => ({
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
  ...input
})

describe('StatsView', () => {
  test('renders top summary cards and actual break totals', () => {
    const html = renderToStaticMarkup(<StatsView stats={createStats()} />)

    expect(html).toContain('aria-label="统计时间范围"')
    expect(html).toContain('data-summary-surface="white-card"')
    expect(html).toContain('data-summary-icon="focus"')
    expect(html).toContain('data-summary-icon="pomodoros"')
    expect(html).toContain('data-summary-icon="tasks"')
    expect(html).toContain('data-summary-icon="breaks"')
    expect(html.match(/data-summary-surface="white-card"/g)?.length).toBe(4)
    expect(html).toContain('专注时长')
    expect(html).toContain('完成番茄')
    expect(html).toContain('任务完成数')
    expect(html).toContain('休息时长')
    expect(html).toContain('0h 20m')
    expect(html).toContain('短休息')
    expect(html).toContain('5m')
    expect(html).toContain('长休息')
    expect(html).toContain('15m')
  })

  test('renders all ranked task duration rows from stats and y-axis ticks', () => {
    const html = renderToStaticMarkup(
      <StatsView
        stats={createStats({
          hourlyFocusMinutes: [0, 25, 50, ...Array.from({ length: 21 }, () => 0)],
          taskFocusMinutes: [
            {
              taskId: 'task-a',
              title: '任务 A',
              minutes: 40,
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
          ]
        })}
      />
    )

    expect(html).toContain('任务时长')
    expect(html).toContain('今日已完成')
    expect(html).toContain('峰值 50m')
    expect(html).toContain('aria-label="今日专注分布刻度"><span>50m</span><span>25m</span><span>0</span>')
    expect(html).toContain('任务 A')
    expect(html).toContain('40m')
    expect(html).toContain('25m')
    expect(html).toContain('0')
    expect(html).toContain('任务 B')
    expect(html).toContain('任务 C')
    expect(html).toContain('任务 D')
    expect(html).toContain('任务 E')
    expect(html).toContain('任务 F')
    expect(html).toContain('5m')
    expect(html).not.toContain('进行中')
    expect(html).not.toContain('今日任务总时长')
    expect(html).not.toContain('已完成任务时长')
    expect(html).not.toContain('进行中任务时长')
    expect(html).not.toContain('已删除任务')
    expect(html).toContain('25m')
  })

  test('renders a clear task ranking empty state', () => {
    const html = renderToStaticMarkup(<StatsView stats={createStats({ taskFocusMinutes: [] })} />)

    expect(html).toContain('今天还没有已完成任务时长')
  })

  test('hides empty hourly bars instead of rendering misleading minimum columns', () => {
    expect(getHourBarHeight(0, 30)).toBe('0%')
    expect(getHourBarHeight(15, 30)).toBe('50%')
  })

  test('scales task ranking bars by the largest task total', () => {
    expect(getRankBarWidth(0, 50)).toBe('0%')
    expect(getRankBarWidth(25, 50)).toBe('50%')
  })
})
