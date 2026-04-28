import { describe, expect, test } from 'vitest'
import { getTimerActionConfirmation, shouldConfirmTimerAction } from './timerActionConfirmation'

describe('timerActionConfirmation', () => {
  test('requires confirmation only when a timer session is still active', () => {
    expect(shouldConfirmTimerAction({ status: 'idle' })).toBe(false)
    expect(shouldConfirmTimerAction({ status: 'completed' })).toBe(false)
    expect(shouldConfirmTimerAction({ status: 'running' })).toBe(true)
    expect(shouldConfirmTimerAction({ status: 'paused' })).toBe(true)
  })

  test('returns localized copy for every risky timer action', () => {
    expect(getTimerActionConfirmation({ kind: 'startFocus' })).toMatchObject({
      subtitle: '计时确认',
      title: '确认结束当前计时并开始新的专注吗？',
      body: '当前计时将立即结束，且不会保留当前进度。',
      confirmLabel: '仍然开始专注',
      tone: 'danger'
    })

    expect(getTimerActionConfirmation({ kind: 'skip' })).toMatchObject({
      subtitle: '计时确认',
      title: '确认跳过当前阶段吗？',
      body: '当前计时将立即结束，并返回待开始状态。',
      confirmLabel: '确认跳过',
      tone: 'danger'
    })

    expect(getTimerActionConfirmation({ kind: 'startShortBreak', minutes: 5 })).toMatchObject({
      subtitle: '计时确认',
      title: '确认结束当前计时并开始短休吗？',
      body: '当前计时将立即结束，并切换到 5 分钟短休。',
      confirmLabel: '仍然开始短休',
      tone: 'danger'
    })

    expect(getTimerActionConfirmation({ kind: 'startLongBreak', minutes: 16 })).toMatchObject({
      subtitle: '计时确认',
      title: '确认结束当前计时并开始长休吗？',
      body: '当前计时将立即结束，并切换到 16 分钟长休。',
      confirmLabel: '仍然开始长休',
      tone: 'danger'
    })

    expect(getTimerActionConfirmation({ kind: 'startFocusWithTask', taskTitle: '任务 A' })).toMatchObject({
      subtitle: '计时确认',
      title: '确认结束当前计时并开始任务「任务 A」吗？',
      body: '当前计时将立即结束，并切换到该任务的新一轮专注。',
      confirmLabel: '仍然开始专注',
      tone: 'danger'
    })
  })
})
