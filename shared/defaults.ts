import type { AppSettings } from './types'

export const defaultSettings: AppSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  notificationsEnabled: true,
  soundEnabled: true,
  openAtLogin: false,
  startToTray: false,
  closeToTray: true,
  themePreference: 'system'
}
