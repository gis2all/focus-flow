import { describe, expect, test } from 'vitest'
import type { TaskBoardItem, TaskBoardSnapshot } from '@shared/types'
import {
  buildTaskRows,
  buildTaskTitleById,
  formatDurationLabel,
  formatTimerClock,
  getTaskRowsForTab,
  reorderTaskIds,
  resolveCurrentTaskTitle,
  resolveEffectiveTheme
} from './viewModel'

const boardItem = (input: Partial<TaskBoardItem> & Pick<TaskBoardItem, 'id' | 'title'>): TaskBoardItem => ({
  sortOrder: 1,
  completedAt: null,
  createdAt: '2026-04-25T09:00:00.000Z',
  updatedAt: '2026-04-25T09:00:00.000Z',
  focusMinutes: 0,
  completedPomodoros: 0,
  ...input
})

const board = (input: Partial<TaskBoardSnapshot> = {}): TaskBoardSnapshot => ({
  counts: {
    all: input.activeItems?.length ?? 0,
    active: input.activeItems?.length ?? 0,
    completed: input.completedItems?.length ?? 0
  },
  activeItems: [],
  completedItems: [],
  ...input
})

describe('renderer view model', () => {
  test('formats timer and duration labels for the FocusFlow desktop UI', () => {
    expect(formatTimerClock(25 * 60_000)).toBe('25:00')
    expect(formatTimerClock(61_000)).toBe('01:01')
    expect(formatDurationLabel(0)).toBe('0m')
    expect(formatDurationLabel(5)).toBe('5m')
    expect(formatDurationLabel(60)).toBe('60m')
    expect(formatDurationLabel(61)).toBe('1h 1m')
    expect(formatDurationLabel(225)).toBe('3h 45m')
  })

  test('resolves explicit theme preference before system theme', () => {
    expect(resolveEffectiveTheme('system', 'dark')).toBe('dark')
    expect(resolveEffectiveTheme('light', 'dark')).toBe('light')
    expect(resolveEffectiveTheme('dark', 'light')).toBe('dark')
  })

  test('builds dense task rows with completed states', () => {
    const rows = buildTaskRows([
      boardItem({ id: 'a', title: '任务 A', completedPomodoros: 2, focusMinutes: 50 }),
      boardItem({
        id: 'b',
        title: '任务 B',
        completedAt: '2026-04-25T10:00:00.000Z',
        completedPomodoros: 1,
        focusMinutes: 25
      })
    ])

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'a',
        statusLabel: '进行中',
        completedPomodoros: 2,
        focusMinutes: 50
      }),
      expect.objectContaining({
        id: 'b',
        statusLabel: '已完成',
        completedPomodoros: 1,
        focusMinutes: 25
      })
    ])
  })

  test('filters task rows by tab while keeping active tasks ahead of completed ones', () => {
    const snapshot = board({
      activeItems: [boardItem({ id: 'a', title: '任务 A' })],
      completedItems: [boardItem({ id: 'b', title: '任务 B', completedAt: '2026-04-25T10:00:00.000Z' })]
    })

    expect(getTaskRowsForTab(snapshot, 'active').map((row) => row.id)).toEqual(['a'])
    expect(getTaskRowsForTab(snapshot, 'completed').map((row) => row.id)).toEqual(['b'])
    expect(getTaskRowsForTab(snapshot, 'all').map((row) => row.id)).toEqual(['a', 'b'])
  })

  test('builds task title lookup and reorders active task ids', () => {
    const snapshot = board({
      activeItems: [boardItem({ id: 'a', title: '任务 A' })],
      completedItems: [boardItem({ id: 'b', title: '任务 B', completedAt: '2026-04-25T10:00:00.000Z' })]
    })

    expect(buildTaskTitleById(snapshot)).toEqual({ a: '任务 A', b: '任务 B' })
    expect(reorderTaskIds(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
  })

  test('resolves the timer task title from the running session instead of the selected task', () => {
    expect(resolveCurrentTaskTitle({ taskId: 'a', phase: 'focus', status: 'running' }, { a: '任务 A' })).toBe('任务 A')
    expect(resolveCurrentTaskTitle({ taskId: 'missing', phase: 'focus', status: 'running' }, {})).toBe('已删除任务')
    expect(resolveCurrentTaskTitle({ taskId: null, phase: 'focus', status: 'idle' }, {})).toBe('当前尚未开始专注')
    expect(resolveCurrentTaskTitle({ taskId: null, phase: 'shortBreak', status: 'running' }, {})).toBe(
      '当前阶段未绑定任务'
    )
  })
})
