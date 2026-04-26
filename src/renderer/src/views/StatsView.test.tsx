import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { FocusStats, TaskBoardSnapshot } from '@shared/types'
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

const createTaskBoard = (input: Partial<TaskBoardSnapshot> = {}): TaskBoardSnapshot => ({
  counts: {
    all: 0,
    active: 0,
    completed: 0
  },
  activeItems: [],
  completedItems: [],
  ...input
})

describe('StatsView', () => {
  test('renders top summary cards and actual break totals', () => {
    const html = renderToStaticMarkup(<StatsView stats={createStats()} taskBoard={createTaskBoard()} />)

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

  test('renders only completed task duration rows and y-axis ticks', () => {
    const html = renderToStaticMarkup(
      <StatsView
        stats={createStats({
          hourlyFocusMinutes: [0, 25, 50, ...Array.from({ length: 21 }, () => 0)],
          taskFocusMinutes: []
        })}
        taskBoard={createTaskBoard({
          activeItems: [
            {
              id: 'task-a',
              title: '任务 A',
              sortOrder: 1,
              completedAt: null,
              createdAt: '2026-04-25T09:00:00.000Z',
              updatedAt: '2026-04-25T09:00:00.000Z',
              focusMinutes: 40,
              completedPomodoros: 2
            }
          ],
          completedItems: [
            {
              id: 'task-b',
              title: '任务 B',
              sortOrder: 0,
              completedAt: '2026-04-25T10:00:00.000Z',
              createdAt: '2026-04-25T09:00:00.000Z',
              updatedAt: '2026-04-25T10:00:00.000Z',
              focusMinutes: 25,
              completedPomodoros: 1
            },
            {
              id: 'task-c',
              title: '任务 C',
              sortOrder: 0,
              completedAt: '2026-04-25T11:00:00.000Z',
              createdAt: '2026-04-25T09:00:00.000Z',
              updatedAt: '2026-04-25T11:00:00.000Z',
              focusMinutes: 0,
              completedPomodoros: 0
            }
          ]
        })}
      />
    )

    expect(html).toContain('任务时长')
    expect(html).toContain('今日已完成')
    expect(html).toContain('峰值 50m')
    expect(html).toContain('25m')
    expect(html).toContain('0')
    expect(html).toContain('任务 B')
    expect(html).not.toContain('任务 A')
    expect(html).not.toContain('任务 C')
    expect(html).not.toContain('40m')
    expect(html).not.toContain('进行中')
    expect(html).not.toContain('今日任务总时长')
    expect(html).not.toContain('已完成任务时长')
    expect(html).not.toContain('进行中任务时长')
    expect(html).not.toContain('已删除任务')
    expect(html).toContain('25m')
  })

  test('renders a clear task ranking empty state', () => {
    const html = renderToStaticMarkup(
      <StatsView stats={createStats({ taskFocusMinutes: [] })} taskBoard={createTaskBoard()} />
    )

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
