import { describe, expect, test, vi } from 'vitest'
import {
  buildTimerFinishedNotificationCopy,
  resolveWindowsAppUserModelId,
  showTimerFinishedNotification,
  WINDOWS_APP_USER_MODEL_ID,
  type NotificationOptionsLike
} from './notificationHelpers'

const packagedExecPath = 'C:\\Users\\test-user\\AppData\\Local\\Programs\\focusflow\\focusflow.exe'
const developmentExecPath = 'C:\\dev\\focusflow\\node_modules\\electron\\dist\\electron.exe'
const notificationIconPath = 'C:\\dev\\focusflow\\main\\assets\\focusflow-icon.png'

describe('notificationHelpers', () => {
  test('returns the packaged Windows AppUserModelId', () => {
    expect(resolveWindowsAppUserModelId(true, packagedExecPath)).toBe(WINDOWS_APP_USER_MODEL_ID)
  })

  test('returns process.execPath as the development Windows AppUserModelId', () => {
    expect(resolveWindowsAppUserModelId(false, developmentExecPath)).toBe(developmentExecPath)
  })

  test('builds Chinese copy for completed focus notifications', () => {
    expect(buildTimerFinishedNotificationCopy('focus')).toEqual({
      title: '专注结束',
      body: '该休息一下了。'
    })
  })

  test('builds Chinese copy for completed break notifications', () => {
    expect(buildTimerFinishedNotificationCopy('longBreak')).toEqual({
      title: '休息结束',
      body: '准备开始下一轮专注。'
    })
  })

  test('wires notification click back to the provided callback', () => {
    const onClick = vi.fn()
    const show = vi.fn()
    let recordedOptions: NotificationOptionsLike | null = null
    const clickListeners: Array<() => void> = []

    showTimerFinishedNotification({
      snapshot: { phase: 'focus' },
      iconPath: notificationIconPath,
      onClick,
      createNotification: (options) => {
        recordedOptions = options
        return {
          show,
          on: (event, listener) => {
            if (event === 'click') {
              clickListeners.push(listener)
            }
          }
        }
      }
    })

    expect(recordedOptions).toEqual({
      title: '专注结束',
      body: '该休息一下了。',
      icon: notificationIconPath
    })
    expect(show).toHaveBeenCalledTimes(1)

    expect(clickListeners).toHaveLength(1)
    clickListeners[0]!()
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
