import type { AppSettings, TimerPhase, TimerSnapshot } from '@shared/types'

const focusTitle = '\u4e13\u6ce8\u5b8c\u6210\uff0c\u8be5\u4f11\u606f\u4e86\u3002'
const breakTitle = '\u4f11\u606f\u7ed3\u675f\uff0c\u53ef\u4ee5\u5f00\u59cb\u4e13\u6ce8\u4e86\u3002'

const showCompletionNotification = (phase: TimerPhase): void => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification('FocusFlow', {
      body: phase === 'focus' ? focusTitle : breakTitle
    })
  } catch {
    // Some browsers throw when notifications are blocked; ignore.
  }
}

const playCompletionBeep = (): void => {
  try {
    const ContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!ContextCtor) return

    const context = new ContextCtor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.frequency.value = 880
    oscillator.type = 'sine'
    gain.gain.value = 0.12
    oscillator.start()
    oscillator.stop(context.currentTime + 0.35)
    oscillator.onended = () => {
      void context.close().catch(() => {})
    }
  } catch {
    // Audio is best-effort; ignore failures (e.g. autoplay policy).
  }
}

export const notifyTimerCompletion = (snapshot: TimerSnapshot, settings: AppSettings): void => {
  if (snapshot.status !== 'completed') return
  if (settings.notificationsEnabled) showCompletionNotification(snapshot.phase)
  if (settings.soundEnabled) playCompletionBeep()
}
