import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import type { TimerSnapshot } from '@shared/types'
import { TimerView, getPrimaryTimerAction } from './TimerView'

const createSnapshot = (input: Partial<TimerSnapshot> = {}): TimerSnapshot => ({
  status: 'idle',
  phase: 'focus',
  taskId: null,
  startedAt: null,
  targetEndAt: null,
  durationMs: 25 * 60_000,
  remainingMs: 25 * 60_000,
  focusCount: 0,
  sessionId: null,
  updatedAt: 0,
  elapsedMs: 0,
  progress: 0,
  ...input
})

const noopAsync = async (): Promise<void> => undefined

describe('TimerView', () => {
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
    expect(pausedBreakHtml).toContain('短休 · 5 分钟')
    expect(pausedBreakHtml).toContain('长休 · 15 分钟')

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
})
