import { describe, expect, test } from 'vitest'
import { aggregateMonthStats, aggregateStats } from './statsAggregator'
import type { FocusStats, MonthStats, Task, TimerSession } from '@shared/types'

const task = (input: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({
  sortOrder: 1,
  completedAt: null,
  createdAt: '2026-04-24T08:00:00.000Z',
  updatedAt: '2026-04-24T08:00:00.000Z',
  ...input
})

const session = (input: Partial<TimerSession> & Pick<TimerSession, 'id' | 'startedAt' | 'phase'>): TimerSession => ({
  taskId: null,
  endedAt: null,
  durationMs: 25 * 60_000,
  actualDurationMs: 25 * 60_000,
  completed: true,
  completionReason: 'completed',
  createdAt: input.startedAt,
  updatedAt: input.startedAt,
  ...input
})

describe('stats aggregator', () => {
  test('aggregates today focus minutes, tracks unbound focus, and only ranks tasks completed today with focus time', () => {
    const stats = aggregateStats({
      now: new Date('2026-04-25T20:00:00.000'),
      tasks: [
        task({ id: 'design', title: 'Design' }),
        task({ id: 'writing', title: 'Writing' }),
        task({ id: 'done', title: 'Done', completedAt: '2026-04-25T08:00:00.000Z' }),
        task({ id: 'done-no-focus', title: 'Done No Focus', completedAt: '2026-04-25T09:00:00.000Z' }),
        task({ id: 'done-yesterday', title: 'Done Yesterday', completedAt: '2026-04-24T14:00:00.000Z' })
      ],
      sessions: [
        session({
          id: 'today-focus-1',
          phase: 'focus',
          taskId: 'design',
          startedAt: '2026-04-25T09:00:00.000',
          actualDurationMs: 25 * 60_000
        }),
        session({
          id: 'today-focus-2',
          phase: 'focus',
          taskId: 'design',
          startedAt: '2026-04-25T10:00:00.000',
          actualDurationMs: 20 * 60_000
        }),
        session({
          id: 'today-break',
          phase: 'shortBreak',
          startedAt: '2026-04-25T10:25:00.000',
          actualDurationMs: 5 * 60_000
        }),
        session({
          id: 'today-long-break',
          phase: 'longBreak',
          startedAt: '2026-04-25T18:00:00.000',
          actualDurationMs: 15 * 60_000
        }),
        session({
          id: 'today-unbound-focus',
          phase: 'focus',
          startedAt: '2026-04-25T11:00:00.000',
          actualDurationMs: 18 * 60_000
        }),
        session({
          id: 'yesterday-focus',
          phase: 'focus',
          taskId: 'writing',
          startedAt: '2026-04-24T11:00:00.000',
          actualDurationMs: 30 * 60_000
        }),
        session({
          id: 'today-completed-task-focus',
          phase: 'focus',
          taskId: 'done',
          startedAt: '2026-04-25T14:00:00.000',
          actualDurationMs: 10 * 60_000
        }),
        session({
          id: 'today-yesterday-completed-task-focus',
          phase: 'focus',
          taskId: 'done-yesterday',
          startedAt: '2026-04-25T16:00:00.000',
          actualDurationMs: 12 * 60_000
        }),
        session({
          id: 'today-deleted-task-focus',
          phase: 'focus',
          taskId: 'deleted',
          startedAt: '2026-04-25T15:00:00.000',
          actualDurationMs: 35 * 60_000
        }),
        session({
          id: 'skipped',
          phase: 'focus',
          taskId: 'ignored',
          startedAt: '2026-04-25T12:00:00.000',
          actualDurationMs: 10 * 60_000,
          completed: false,
          completionReason: 'skipped'
        })
      ]
    }) as FocusStats & { unboundFocusMinutes: number }

    expect(stats.today.focusMinutes).toBe(120)
    expect(stats.today.shortBreakMinutes).toBe(5)
    expect(stats.today.longBreakMinutes).toBe(15)
    expect(stats.today.completedPomodoros).toBe(6)
    expect(stats.hourlyFocusMinutes[9]).toBe(25)
    expect(stats.hourlyFocusMinutes[10]).toBe(20)
    expect(stats.weeklyTrend.at(-1)?.focusMinutes).toBe(120)
    expect(stats.unboundFocusMinutes).toBe(18)
    expect(stats.taskFocusMinutes).toEqual([
      { taskId: 'done', title: 'Done', minutes: 10, status: 'completed' }
    ])
  })

  test('aggregates selected month by local day and keeps task completion scoped to existing tasks', () => {
    const stats = aggregateMonthStats({
      now: new Date('2026-04-25T12:00:00+08:00'),
      year: 2026,
      month: 4,
      tasks: [
        task({ id: 'local-april-task', title: 'Local April Task', completedAt: '2026-03-31T16:10:00.000Z' }),
        task({ id: 'april-task', title: 'April Task', completedAt: '2026-04-10T09:00:00.000+08:00' }),
        task({ id: 'active-task', title: 'Active Task' }),
        task({
          id: 'completed-other-day',
          title: 'Completed Other Day',
          completedAt: '2026-04-11T09:00:00.000+08:00'
        }),
        task({ id: 'may-task', title: 'May Task', completedAt: '2026-05-01T09:00:00.000+08:00' })
      ],
      sessions: [
        session({
          id: 'local-april-unbound',
          phase: 'focus',
          startedAt: '2026-03-31T16:30:00.000Z',
          actualDurationMs: 25 * 60_000
        }),
        session({
          id: 'april-bound',
          phase: 'focus',
          taskId: 'april-task',
          startedAt: '2026-04-10T10:00:00.000+08:00',
          actualDurationMs: 30 * 60_000
        }),
        session({
          id: 'april-active-task-focus',
          phase: 'focus',
          taskId: 'active-task',
          startedAt: '2026-04-10T10:30:00.000+08:00',
          actualDurationMs: 7 * 60_000
        }),
        session({
          id: 'april-other-day-completed-task-focus',
          phase: 'focus',
          taskId: 'completed-other-day',
          startedAt: '2026-04-10T10:45:00.000+08:00',
          actualDurationMs: 8 * 60_000
        }),
        session({
          id: 'april-deleted-task-focus',
          phase: 'focus',
          taskId: 'deleted-task',
          startedAt: '2026-04-10T11:00:00.000+08:00',
          actualDurationMs: 20 * 60_000
        }),
        session({
          id: 'april-short-break',
          phase: 'shortBreak',
          startedAt: '2026-04-01T01:00:00.000+08:00',
          actualDurationMs: 5 * 60_000
        }),
        session({
          id: 'april-long-break',
          phase: 'longBreak',
          startedAt: '2026-04-10T12:00:00.000+08:00',
          actualDurationMs: 15 * 60_000
        }),
        session({
          id: 'may-focus',
          phase: 'focus',
          startedAt: '2026-05-01T10:00:00.000+08:00',
          actualDurationMs: 45 * 60_000
        }),
        session({
          id: 'skipped-april-focus',
          phase: 'focus',
          startedAt: '2026-04-11T10:00:00.000+08:00',
          actualDurationMs: 25 * 60_000,
          completed: false,
          completionReason: 'skipped'
        })
      ]
    }) as MonthStats

    expect(stats.year).toBe(2026)
    expect(stats.month).toBe(4)
    expect(stats.days).toHaveLength(30)
    expect(stats.summary).toEqual({
      focusMinutes: 90,
      completedPomodoros: 5,
      completedTasks: 3,
      shortBreakMinutes: 5,
      longBreakMinutes: 15
    })
    expect(stats.maxFocusMinutes).toBe(65)
    expect(stats.days[0]).toMatchObject({
      date: '2026-04-01',
      focusMinutes: 25,
      completedPomodoros: 1,
      completedTasks: 1,
      shortBreakMinutes: 5,
      longBreakMinutes: 0,
      isFuture: false,
      taskFocusMinutes: [],
      unboundFocusMinutes: 25
    })
    expect(stats.days[9]).toMatchObject({
      date: '2026-04-10',
      focusMinutes: 65,
      completedPomodoros: 4,
      completedTasks: 1,
      shortBreakMinutes: 0,
      longBreakMinutes: 15,
      isFuture: false,
      unboundFocusMinutes: 0
    })
    expect(stats.days[9].taskFocusMinutes).toEqual([
      { taskId: 'april-task', title: 'April Task', minutes: 30, status: 'completed' }
    ])
    expect(stats.days[25]).toMatchObject({
      date: '2026-04-26',
      focusMinutes: 0,
      completedPomodoros: 0,
      completedTasks: 0,
      shortBreakMinutes: 0,
      longBreakMinutes: 0,
      isFuture: true,
      taskFocusMinutes: [],
      unboundFocusMinutes: 0
    })
  })
})
