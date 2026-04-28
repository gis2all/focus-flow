import { describe, expect, test } from 'vitest'
import { resolveWindowMode } from './windowMode'

describe('windowMode', () => {
  test('defaults to the main renderer mode when no search parameter is present', () => {
    expect(resolveWindowMode('')).toBe('main')
    expect(resolveWindowMode('?window=unknown')).toBe('main')
  })

  test('selects the mini renderer mode when requested through the query string', () => {
    expect(resolveWindowMode('?window=mini')).toBe('mini')
  })
})
