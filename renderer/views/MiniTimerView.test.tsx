import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import type { TimerSnapshot } from '@shared/types'
import { MiniTimerView } from './MiniTimerView'

const createSnapshot = (input: Partial<TimerSnapshot> = {}): TimerSnapshot => ({
  status: 'idle',
  phase: 'focus',
  taskId: null,
  startedAt: null,
  targetEndAt: null,
  durationMs: 25 * 60_000,
  remainingMs: 25 * 60_000,
  focusCount: 0,
  unboundFocusCount: 0,
  lastFocusTaskId: null,
  sessionId: null,
  updatedAt: 0,
  elapsedMs: 0,
  progress: 0,
  ...input
})

describe('MiniTimerView', () => {
  test('renders the status text without the mini status badge decoration', () => {
    const html = renderToStaticMarkup(
      <MiniTimerView
        activeTheme="light"
        settings={defaultSettings}
        snapshot={createSnapshot({
          status: 'running',
          phase: 'focus',
          remainingMs: 23 * 60_000 + 12_000
        })}
      />
    )

    expect(html).toContain('专注中')
    expect(html).not.toContain('miniStatusBadge')
    expect(html).not.toContain('miniStatusHalo')
    expect(html).not.toContain('miniStatusCore')
  })

  test('renders the active phase label and remaining time for running or paused timers', () => {
    const html = renderToStaticMarkup(
      <MiniTimerView
        activeTheme="light"
        settings={defaultSettings}
        snapshot={createSnapshot({
          status: 'paused',
          phase: 'longBreak',
          remainingMs: 14 * 60_000 + 32_000
        })}
      />
    )

    expect(html).toContain('长休息')
    expect(html).toContain('14')
    expect(html).toContain('32')
    expect(html).toContain('aria-label="拖动小窗"')
    expect(html).toContain('aria-label="返回主窗口"')
    expect(html).toContain('timerDigits')
    expect(html).not.toContain('miniStatusPill')
  })

  test('renders a pending state with the next focus duration when no timer is active', () => {
    const html = renderToStaticMarkup(
      <MiniTimerView
        activeTheme="dark"
        settings={{ ...defaultSettings, focusMinutes: 40 }}
        snapshot={createSnapshot({
          status: 'completed',
          phase: 'shortBreak',
          remainingMs: 0
        })}
      />
    )

    expect(html).toContain('待开始')
    expect(html).toContain('40')
    expect(html).toContain('00')
    expect(html).not.toContain('当前任务')
    expect(html).not.toContain('长休进度')
    expect(html).not.toContain('暂停')
  })
})
