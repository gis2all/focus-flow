import { describe, expect, test, vi } from 'vitest'
import { IPC_CHANNELS } from '@shared/contracts'
import type { TimerSnapshot } from '@shared/types'
import { createTimerTickRunner, wireTimerSnapshotBroadcast } from './timerSnapshotBroadcast'

const createSnapshot = (): TimerSnapshot => ({
  status: 'running',
  phase: 'focus',
  taskId: 'task-1',
  startedAt: Date.parse('2026-04-29T08:00:00.000Z'),
  targetEndAt: Date.parse('2026-04-29T08:25:00.000Z'),
  durationMs: 25 * 60_000,
  remainingMs: 24 * 60_000,
  focusCount: 2,
  unboundFocusCount: 0,
  lastFocusTaskId: 'task-1',
  sessionId: 'session-1',
  updatedAt: Date.parse('2026-04-29T08:01:00.000Z'),
  elapsedMs: 60_000,
  progress: 1 / 25
})

describe('timer snapshot broadcast wiring', () => {
  test('broadcasts each published snapshot once to every open window', () => {
    const snapshot = createSnapshot()
    const sendToMain = vi.fn()
    const sendToMini = vi.fn()
    let publish: (value: TimerSnapshot) => void = () => {
      throw new Error('Expected snapshot listener to be registered')
    }
    const timer = {
      onSnapshot: vi.fn((listener: (value: TimerSnapshot) => void) => {
        publish = listener
        return vi.fn()
      })
    }

    wireTimerSnapshotBroadcast({
      timer,
      getWindows: () =>
        [
          { webContents: { send: sendToMain } },
          { webContents: { send: sendToMini } }
        ] as Array<{ webContents: { send: typeof sendToMain } }>
    })

    publish(snapshot)

    expect(timer.onSnapshot).toHaveBeenCalledTimes(1)
    expect(sendToMain).toHaveBeenCalledTimes(1)
    expect(sendToMain).toHaveBeenCalledWith(IPC_CHANNELS.timer.snapshot, snapshot)
    expect(sendToMini).toHaveBeenCalledTimes(1)
    expect(sendToMini).toHaveBeenCalledWith(IPC_CHANNELS.timer.snapshot, snapshot)
  })

  test('publishing a snapshot is a safe no-op when no windows are open', () => {
    const snapshot = createSnapshot()
    let publish: (value: TimerSnapshot) => void = () => {
      throw new Error('Expected snapshot listener to be registered')
    }

    wireTimerSnapshotBroadcast({
      timer: {
        onSnapshot: vi.fn((listener: (value: TimerSnapshot) => void) => {
          publish = listener
          return vi.fn()
        })
      },
      getWindows: () => []
    })

    expect(() => publish(snapshot)).not.toThrow()
  })

  test('tick relies on TimerService publish and does not manually broadcast the returned snapshot again', async () => {
    const snapshot = createSnapshot()
    const send = vi.fn()
    let publish: (value: TimerSnapshot) => void = () => {
      throw new Error('Expected snapshot listener to be registered')
    }
    const timer = {
      onSnapshot: vi.fn((listener: (value: TimerSnapshot) => void) => {
        publish = listener
        return vi.fn()
      }),
      tick: vi.fn(async () => {
        publish(snapshot)
        return snapshot
      })
    }
    const onError = vi.fn()

    wireTimerSnapshotBroadcast({
      timer,
      getWindows: () => [{ webContents: { send } }] as Array<{ webContents: { send: typeof send } }>
    })

    await createTimerTickRunner({ timer, onError })()

    expect(timer.tick).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.timer.snapshot, snapshot)
    expect(onError).not.toHaveBeenCalled()
  })
})
