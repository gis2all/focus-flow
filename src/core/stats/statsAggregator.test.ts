import { describe, expect, test } from 'vitest'
import { aggregateStats } from './statsAggregator'
import type { TimerSession } from '@shared/types'

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
  test('aggregates today focus minutes, completed pomodoros, hourly distribution, weekly trend and task focus', () => {
    const stats = aggregateStats({
      now: new Date('2026-04-25T20:00:00.000'),
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
          id: 'yesterday-focus',
          phase: 'focus',
          taskId: 'writing',
          startedAt: '2026-04-24T11:00:00.000',
          actualDurationMs: 30 * 60_000
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
    })

    expect(stats.today.focusMinutes).toBe(45)
    expect(stats.today.completedPomodoros).toBe(2)
    expect(stats.hourlyFocusMinutes[9]).toBe(25)
    expect(stats.hourlyFocusMinutes[10]).toBe(20)
    expect(stats.weeklyTrend.at(-1)?.focusMinutes).toBe(45)
    expect(stats.taskFocusMinutes).toEqual([
      { taskId: 'design', minutes: 45 },
      { taskId: 'writing', minutes: 30 }
    ])
  })
})
