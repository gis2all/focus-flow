import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import type { TaskBoardSnapshot, TimerSnapshot } from '@shared/types'
import { TimerView, getPrimaryTimerAction } from './TimerView'
import { getSmoothedTimerProgress, resolveTimerPomodoroDisplay } from '../viewModel'

const createSnapshot = (input: Partial<TimerSnapshot> = {}): TimerSnapshot => ({
  status: 'idle',
  phase: 'focus',
  taskId: null,
  startedAt: null,
  targetEndAt: null,
  durationMs: 25 * 60_000,
  remainingMs: 25 * 60_000,
  focusCount: 0,
  unboundFocusCount: 0,
  lastFocusTaskId: null,
  sessionId: null,
  updatedAt: 0,
  elapsedMs: 0,
  progress: 0,
  ...input
})

const noopAsync = async (): Promise<void> => undefined

const taskBoard: TaskBoardSnapshot = {
  counts: {
    all: 2,
    active: 2,
    completed: 0
  },
  activeItems: [
    {
      id: 'task-1',
      title: '任务 A',
      sortOrder: 1,
      completedAt: null,
      createdAt: '2026-04-25T09:00:00.000Z',
      updatedAt: '2026-04-25T09:00:00.000Z',
      focusMinutes: 25,
      completedPomodoros: 1
    },
    {
      id: 'task-2',
      title: '任务 B',
      sortOrder: 2,
      completedAt: null,
      createdAt: '2026-04-25T09:00:00.000Z',
      updatedAt: '2026-04-25T09:00:00.000Z',
      focusMinutes: 50,
      completedPomodoros: 4
    }
  ],
  completedItems: []
}

describe('TimerView', () => {
  test('computes smooth timer progress linearly while running', () => {
    const snapshot = createSnapshot({
      status: 'running',
      startedAt: 1_000,
      targetEndAt: 11_000,
      durationMs: 10_000,
      progress: 0.1
    })

    expect(getSmoothedTimerProgress(snapshot, 1_000)).toBe(0)
    expect(getSmoothedTimerProgress(snapshot, 6_000)).toBe(0.5)
    expect(getSmoothedTimerProgress(snapshot, 13_000)).toBe(1)
  })

  test('keeps progress after resume instead of restarting from zero', () => {
    const resumedSnapshot = createSnapshot({
      status: 'running',
      startedAt: 6_000,
      targetEndAt: 11_000,
      durationMs: 10_000,
      remainingMs: 5_000,
      progress: 0.5
    })

    expect(getSmoothedTimerProgress(resumedSnapshot, 6_000)).toBe(0.5)
    expect(getSmoothedTimerProgress(resumedSnapshot, 8_500)).toBe(0.75)
  })

  test('falls back to snapshot progress for paused or incomplete timer state', () => {
    expect(
      getSmoothedTimerProgress(
        createSnapshot({
          status: 'paused',
          progress: 0.35,
          startedAt: 1_000,
          targetEndAt: 11_000,
          durationMs: 10_000
        }),
        6_000
      )
    ).toBe(0.35)

    expect(
      getSmoothedTimerProgress(
        createSnapshot({
          status: 'running',
          progress: 0.4,
          startedAt: null,
          targetEndAt: null
        }),
        6_000
      )
    ).toBe(0.4)
  })

  test('derives the primary action label from timer status and phase', () => {
    expect(getPrimaryTimerAction(createSnapshot({ status: 'idle', phase: 'focus' }))).toMatchObject({
      label: '开始专注',
      action: 'start'
    })
    expect(getPrimaryTimerAction(createSnapshot({ status: 'completed', phase: 'focus' }))).toMatchObject({
      label: '开始专注',
      action: 'start'
    })
    expect(getPrimaryTimerAction(createSnapshot({ status: 'paused', phase: 'focus' }))).toMatchObject({
      label: '继续专注',
      action: 'resume'
    })
    expect(getPrimaryTimerAction(createSnapshot({ status: 'paused', phase: 'shortBreak' }))).toMatchObject({
      label: '继续休息',
      action: 'resume'
    })
    expect(getPrimaryTimerAction(createSnapshot({ status: 'paused', phase: 'longBreak' }))).toMatchObject({
      label: '继续休息',
      action: 'resume'
    })
  })

  test('renders the new auto-switch label without trailing on off text', () => {
    const html = renderToStaticMarkup(
      <TimerView
        currentTaskTitle="当前尚未开始专注"
        progressPercent={0}
        settings={defaultSettings}
        snapshot={createSnapshot({ status: 'paused', phase: 'focus' })}
        startTimer={noopAsync}
        updateSettings={noopAsync}
      />
    )

    expect(html).toContain('自动切换专注/休息')
    expect(html).not.toContain('沉浸专注，时间为你而在')
    expect(html).not.toContain('>开<')
    expect(html).not.toContain('>关<')
  })

  test('renders unified action button labels for paused break and idle states', () => {
    const pausedBreakHtml = renderToStaticMarkup(
      <TimerView
        currentTaskTitle="当前阶段未绑定任务"
        progressPercent={35}
        settings={defaultSettings}
        snapshot={createSnapshot({ status: 'paused', phase: 'shortBreak' })}
        startTimer={noopAsync}
        updateSettings={noopAsync}
      />
    )

    expect(pausedBreakHtml).toContain('继续休息')
    expect(pausedBreakHtml).toContain('暂停')
    expect(pausedBreakHtml).toContain('跳过')
    expect(pausedBreakHtml).toContain('短休 · 5m')
    expect(pausedBreakHtml).toContain('长休 · 15m')

    const idleHtml = renderToStaticMarkup(
      <TimerView
        currentTaskTitle="当前尚未开始专注"
        progressPercent={0}
        settings={defaultSettings}
        snapshot={createSnapshot({ status: 'idle', phase: 'focus' })}
        startTimer={noopAsync}
        updateSettings={noopAsync}
      />
    )

    expect(idleHtml).toContain('开始专注')
  })

  test('formats long action button durations with the shared non-settings label rules', () => {
    const html = renderToStaticMarkup(
      <TimerView
        currentTaskTitle="当前尚未开始专注"
        progressPercent={0}
        settings={{ ...defaultSettings, shortBreakMinutes: 60, longBreakMinutes: 75 }}
        snapshot={createSnapshot({ status: 'idle', phase: 'focus' })}
        startTimer={noopAsync}
        updateSettings={noopAsync}
      />
    )

    expect(html).toContain('短休 · 60m')
    expect(html).toContain('长休 · 1h 15m')
  })

  test('renders the dial progress style from non-rounded progress values', () => {
    const html = renderToStaticMarkup(
      <TimerView
        currentTaskTitle="当前阶段未绑定任务"
        progressPercent={33.3333}
        settings={defaultSettings}
        snapshot={createSnapshot({ status: 'running', phase: 'focus', progress: 0.333333 })}
        startTimer={noopAsync}
        updateSettings={noopAsync}
      />
    )

    expect(html).toContain('--progress-value:33.3333')
  })

  test('renders focused count without estimated copy and keeps long-break progress unit on one line', () => {
    const html = renderToStaticMarkup(
      <TimerView
        currentTaskTitle="当前尚未开始专注"
        progressPercent={25}
        settings={{ ...defaultSettings, longBreakInterval: 5 }}
        snapshot={createSnapshot({ status: 'idle', phase: 'focus', focusCount: 0, progress: 0.25 })}
        startTimer={noopAsync}
        updateSettings={noopAsync}
      />
    )

    expect(html).toContain('已专注：0 个番茄钟')
    expect(html).not.toContain('预计专注')
    expect(html).not.toContain('当前任务')
    expect(html).toContain('长休进度')
    expect(html).not.toContain('focusDialProgress')
    expect(html).toContain('1/5轮')
    expect(html).not.toContain('>1/5<')
  })

  test('renders the long-break progress circle after at least one completed focus', () => {
    const html = renderToStaticMarkup(
      <TimerView
        currentTaskTitle="当前尚未开始专注"
        progressPercent={25}
        settings={{ ...defaultSettings, longBreakInterval: 5 }}
        snapshot={createSnapshot({ status: 'running', phase: 'focus', focusCount: 1, progress: 0.25 })}
        startTimer={noopAsync}
        updateSettings={noopAsync}
      />
    )

    expect(html).toContain('focusDialProgress')
    expect(html).toContain('1/5轮')
  })

  test('renders the progress circle while a session is running even before the first completed focus', () => {
    const html = renderToStaticMarkup(
      <TimerView
        currentTaskTitle="当前尚未开始专注"
        progressPercent={0}
        settings={{ ...defaultSettings, longBreakInterval: 5 }}
        snapshot={createSnapshot({ status: 'running', phase: 'focus', focusCount: 0, progress: 0 })}
        startTimer={noopAsync}
        updateSettings={noopAsync}
      />
    )

    expect(html).toContain('focusDialProgress')
    expect(html).toContain('1/5轮')
  })

  test('derives task-bound pomodoro display from the bound task instead of global focus count', () => {
    const display = resolveTimerPomodoroDisplay(
      createSnapshot({
        status: 'running',
        phase: 'focus',
        taskId: 'task-1',
        focusCount: 7
      } as any),
      taskBoard
    )

    expect(display).toEqual({
      ordinal: 2,
      completed: 1
    })
  })

  test('derives unbound pomodoro display from the unbound counter when no task is bound', () => {
    const display = resolveTimerPomodoroDisplay(
      createSnapshot({
        status: 'running',
        phase: 'focus',
        taskId: null,
        focusCount: 7,
        unboundFocusCount: 2
      } as any),
      taskBoard
    )

    expect(display).toEqual({
      ordinal: 3,
      completed: 2
    })
  })

  test('keeps using the last completed task during break phases', () => {
    const display = resolveTimerPomodoroDisplay(
      createSnapshot({
        status: 'running',
        phase: 'shortBreak',
        taskId: null,
        focusCount: 7,
        unboundFocusCount: 2,
        lastFocusTaskId: 'task-1'
      } as any),
      taskBoard
    )

    expect(display).toEqual({
      ordinal: 2,
      completed: 1
    })
  })

  test('falls back to unbound display when the last task context no longer exists', () => {
    const display = resolveTimerPomodoroDisplay(
      createSnapshot({
        status: 'running',
        phase: 'shortBreak',
        taskId: null,
        focusCount: 7,
        unboundFocusCount: 2,
        lastFocusTaskId: 'deleted-task'
      } as any),
      taskBoard
    )

    expect(display).toEqual({
      ordinal: 3,
      completed: 2
    })
  })

  test('renders task pomodoro copy from display props while keeping long-break progress global', () => {
    const props = {
      currentTaskTitle: '任务 A',
      progressPercent: 25,
      settings: { ...defaultSettings, longBreakInterval: 5 },
      snapshot: createSnapshot({ status: 'running', phase: 'focus', focusCount: 7, progress: 0.25 }),
      pomodoroDisplay: { ordinal: 2, completed: 1 },
      startTimer: noopAsync,
      updateSettings: noopAsync
    } as any

    const html = renderToStaticMarkup(<TimerView {...props} />)

    expect(html).toContain('第 2 个番茄钟')
    expect(html).toContain('已专注：1 个番茄钟')
    expect(html).not.toContain('第 8 个番茄钟')
    expect(html).not.toContain('已专注：7 个番茄钟')
    expect(html).toContain('2/5轮')
  })
})
