import type { TimerPhase, TimerSnapshot } from '@shared/types'

export const WINDOWS_APP_USER_MODEL_ID = 'com.focusflow.timer'

export interface NotificationOptionsLike {
  title: string
  body: string
  icon?: string
}

export interface NotificationInstanceLike {
  show(): void
  on?(event: 'click', listener: () => void): unknown
}

export type NotificationFactoryLike = (options: NotificationOptionsLike) => NotificationInstanceLike

export const resolveWindowsAppUserModelId = (isPackaged: boolean, execPath: string): string =>
  isPackaged ? WINDOWS_APP_USER_MODEL_ID : execPath

export const buildTimerFinishedNotificationCopy = (
  phase: TimerPhase
): Pick<NotificationOptionsLike, 'title' | 'body'> => {
  if (phase === 'focus') {
    return {
      title: '专注结束',
      body: '该休息一下了。'
    }
  }

  return {
    title: '休息结束',
    body: '准备开始下一轮专注。'
  }
}

export const showTimerFinishedNotification = ({
  snapshot,
  iconPath,
  createNotification,
  onClick
}: {
  snapshot: Pick<TimerSnapshot, 'phase'>
  iconPath: string
  createNotification: NotificationFactoryLike
  onClick?: () => void
}): void => {
  const notification = createNotification({
    ...buildTimerFinishedNotificationCopy(snapshot.phase),
    icon: iconPath
  })

  if (onClick && typeof notification.on === 'function') {
    notification.on('click', onClick)
  }

  notification.show()
}
