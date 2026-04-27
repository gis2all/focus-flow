import type { TimerPhase } from '@shared/types'
import type { ViewKey } from './types'

export const phaseLabel: Record<TimerPhase, string> = {
  focus: '专注中',
  shortBreak: '短休息',
  longBreak: '长休息'
}

export const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: 'timer', label: '计时' },
  { key: 'tasks', label: '待办' },
  { key: 'stats', label: '统计' },
  { key: 'settings', label: '设置' }
]
