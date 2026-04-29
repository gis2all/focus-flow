import { IPC_CHANNELS } from '@shared/contracts'
import type { TimerSnapshot } from '@shared/types'
import type { TimerService } from '@main/services/timerService'

interface SnapshotWindow {
  webContents: {
    send(channel: string, snapshot: TimerSnapshot): void
  }
}

export const createBroadcastTimerSnapshot =
  (getWindows: () => SnapshotWindow[]) =>
  (snapshot: TimerSnapshot): void => {
    for (const window of getWindows()) {
      window.webContents.send(IPC_CHANNELS.timer.snapshot, snapshot)
    }
  }

export const wireTimerSnapshotBroadcast = ({
  timer,
  getWindows
}: {
  timer: Pick<TimerService, 'onSnapshot'>
  getWindows: () => SnapshotWindow[]
}): (() => void) => timer.onSnapshot(createBroadcastTimerSnapshot(getWindows))

export const createTimerTickRunner = ({
  timer,
  onError
}: {
  timer: Pick<TimerService, 'tick'>
  onError(error: unknown): void
}) => {
  return async (): Promise<void> => {
    try {
      await timer.tick()
    } catch (error) {
      onError(error)
    }
  }
}
