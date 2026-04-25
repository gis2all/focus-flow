import { app, nativeTheme, Notification, shell } from 'electron'
import type { TimerSnapshot } from '@shared/types'
import type { AutoLaunchPort, ClockPort, NotificationPort, SoundPort, SystemThemePort } from '@main/ports/desktop'

export class SystemClock implements ClockPort {
  now(): number {
    return Date.now()
  }

  nowIso(): string {
    return new Date(this.now()).toISOString()
  }
}

export class ElectronNotificationAdapter implements NotificationPort {
  async showTimerFinished(snapshot: TimerSnapshot): Promise<void> {
    if (!Notification.isSupported()) return
    const title = snapshot.phase === 'focus' ? 'Focus session complete' : 'Break complete'
    const body = snapshot.phase === 'focus' ? 'Time to take a short reset.' : 'Ready for the next focus block.'
    new Notification({ title, body }).show()
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
