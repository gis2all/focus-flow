import { app, nativeTheme, Notification, shell } from 'electron'
import type { TimerSnapshot } from '@shared/types'
import type { AutoLaunchPort, ClockPort, NotificationPort, SoundPort, SystemThemePort } from '@main/ports/desktop'
import { showTimerFinishedNotification } from './notificationHelpers'

export class SystemClock implements ClockPort {
  now(): number {
    return Date.now()
  }

  nowIso(): string {
    return new Date(this.now()).toISOString()
  }
}

export class ElectronNotificationAdapter implements NotificationPort {
  constructor(
    private readonly options: {
      iconPath: string
      onClick?: () => void
    }
  ) {}

  async showTimerFinished(snapshot: TimerSnapshot): Promise<void> {
    if (!Notification.isSupported()) return

    showTimerFinishedNotification({
      snapshot,
      iconPath: this.options.iconPath,
      onClick: this.options.onClick,
      createNotification: (notificationOptions) => new Notification(notificationOptions)
    })
  }
}

export class ElectronSoundAdapter implements SoundPort {
  async playTimerFinished(): Promise<void> {
    shell.beep()
  }
}

export class ElectronAutoLaunchAdapter implements AutoLaunchPort {
  setOpenAtLogin(enabled: boolean, startToTray: boolean): void {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: startToTray ? ['--hidden'] : []
    })
  }
}

export class ElectronSystemThemeAdapter implements SystemThemePort {
  shouldUseDarkColors(): boolean {
    return nativeTheme.shouldUseDarkColors
  }
}
