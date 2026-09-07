import type { AutoLaunchPort, NotificationPort, SoundPort, SystemThemePort } from '@main/ports/desktop'
import type { TimerSnapshot } from '@shared/types'

// Web/server side has no OS notification or audio adapter; the browser client
// is responsible for triggering notifications/sound after it receives a
// completion snapshot over SSE. These ports are explicit no-ops here.
export class NoopNotificationPort implements NotificationPort {
  showTimerFinished(_snapshot: TimerSnapshot): Promise<void> {
    return Promise.resolve()
  }
}

export class NoopSoundPort implements SoundPort {
  playTimerFinished(): Promise<void> {
    return Promise.resolve()
  }
}

export class NoopAutoLaunchPort implements AutoLaunchPort {
  setOpenAtLogin(_enabled: boolean, _startToTray: boolean): void {}
}

export class NoopSystemThemePort implements SystemThemePort {
  shouldUseDarkColors(): boolean {
    return false
  }
}
