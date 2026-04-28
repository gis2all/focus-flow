import type { TimerSnapshot } from '@shared/types'

export type TimerActionConfirmationRequest =
  | { kind: 'startFocus' }
  | { kind: 'skip' }
  | { kind: 'startShortBreak'; minutes: number }
  | { kind: 'startLongBreak'; minutes: number }
  | { kind: 'startFocusWithTask'; taskTitle: string }

export interface TimerActionConfirmationCopy {
  subtitle: string
  title: string
  body: string
  confirmLabel: string
  tone: 'danger'
}

export const shouldConfirmTimerAction = (snapshot: Pick<TimerSnapshot, 'status'>): boolean =>
  snapshot.status === 'running' || snapshot.status === 'paused'

export const getTimerActionConfirmation = (
  action: TimerActionConfirmationRequest
): TimerActionConfirmationCopy => {
  switch (action.kind) {
    case 'startFocus':
      return {
        subtitle: '计时确认',
        title: '确认结束当前计时并开始新的专注吗？',
        body: '当前计时将立即结束，且不会保留当前进度。',
        confirmLabel: '仍然开始专注',
        tone: 'danger'
      }
    case 'skip':
      return {
        subtitle: '计时确认',
        title: '确认跳过当前阶段吗？',
        body: '当前计时将立即结束，并返回待开始状态。',
        confirmLabel: '确认跳过',
        tone: 'danger'
      }
    case 'startShortBreak':
      return {
        subtitle: '计时确认',
        title: '确认结束当前计时并开始短休吗？',
        body: `当前计时将立即结束，并切换到 ${action.minutes} 分钟短休。`,
        confirmLabel: '仍然开始短休',
        tone: 'danger'
      }
    case 'startLongBreak':
      return {
        subtitle: '计时确认',
        title: '确认结束当前计时并开始长休吗？',
        body: `当前计时将立即结束，并切换到 ${action.minutes} 分钟长休。`,
        confirmLabel: '仍然开始长休',
        tone: 'danger'
      }
    case 'startFocusWithTask':
      return {
        subtitle: '计时确认',
        title: `确认结束当前计时并开始任务「${action.taskTitle}」吗？`,
        body: '当前计时将立即结束，并切换到该任务的新一轮专注。',
        confirmLabel: '仍然开始专注',
        tone: 'danger'
      }
  }
}
