import type { AppSettings, TimerPhase } from '@shared/types'
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

export const settingsSections = ['常规', '计时设置', '通知设置', '外观设置', '快捷键', '数据管理', '关于']

export const demoTaskRows = [
  { id: 'demo-1', title: '阅读《高效能人士的七个习惯》', pomodoros: 2, time: '09:15' },
  { id: 'demo-2', title: '回复工作邮件', pomodoros: 2, time: '10:30' },
  { id: 'demo-3', title: '设计番茄钟 UI 原型', pomodoros: 1, time: '--:--' },
  { id: 'demo-4', title: '实现计时与阶段切换逻辑', pomodoros: 1, time: '--:--' },
  { id: 'demo-5', title: '编写文档与使用说明', pomodoros: 1, time: '--:--' }
]

export const settingLabels: Array<[keyof AppSettings, string]> = [
  ['notificationsEnabled', '显示系统通知'],
  ['soundEnabled', '播放提示音'],
  ['openAtLogin', '开机自启'],
  ['startToTray', '启动到托盘'],
  ['closeToTray', '关闭窗口后继续运行']
]
