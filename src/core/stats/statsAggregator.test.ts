import { describe, expect, test } from 'vitest'
import { aggregateStats } from './statsAggregator'
import type { FocusStats, Task, TimerSession } from '@shared/types'

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
})
