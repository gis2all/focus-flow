import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { FocusStats } from '@shared/types'
import { StatsView, getHourBarHeight } from './StatsView'

const createStats = (input: Partial<FocusStats> = {}): FocusStats => ({
  today: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    completedPomodoros: 1,
    completedTasks: 1
  },
  hourlyFocusMinutes: Array.from({ length: 24 }, () => 0),
  weeklyTrend: [],
  taskFocusMinutes: [],
  ...input
})

describe('StatsView', () => {
  test('renders actual short and long break totals instead of percentage-based placeholders', () => {
    const html = renderToStaticMarkup(<StatsView stats={createStats()} taskTitleById={{}} />)

    expect(html).toContain('短休息 5m')
    expect(html).toContain('长休息 15m')
  })

  test('hides empty hourly bars instead of rendering misleading minimum columns', () => {
    expect(getHourBarHeight(0, 30)).toBe('0%')
    expect(getHourBarHeight(15, 30)).toBe('50%')
  })
})
