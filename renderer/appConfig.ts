import type { TimerPhase } from '@shared/types'
import type { ViewKey } from './types'

// Activity-phase labels are consumed by compact status surfaces such as the mini timer.
export const phaseLabel: Record<TimerPhase, string> = {
  focus: '专注中',
  shortBreak: '短休中',
  longBreak: '长休中'
}

export const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: 'timer', label: '计时' },
  { key: 'tasks', label: '待办' },
  { key: 'stats', label: '统计' },
  { key: 'settings', label: '设置' }
]
