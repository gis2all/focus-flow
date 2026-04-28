import type { TimerSnapshot } from '@shared/types'

export interface ClockPort {
  now(): number
  nowIso(): string
}

export interface NotificationPort {
  showTimerFinished(snapshot: TimerSnapshot): Promise<void>
}

export interface SoundPort {
  playTimerFinished(): Promise<void>
}

export interface AutoLaunchPort {
  setOpenAtLogin(enabled: boolean, startToTray: boolean): void
}

export interface SystemThemePort {
  shouldUseDarkColors(): boolean
}
