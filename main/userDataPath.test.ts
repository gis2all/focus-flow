import { describe, expect, test } from 'vitest'
import { resolveUserDataPathOverride } from './userDataPath'

describe('user data path override', () => {
  test('accepts an absolute path for isolated desktop tests', () => {
    expect(resolveUserDataPathOverride('D:\\temp\\focusflow-e2e')).toBe('D:\\temp\\focusflow-e2e')
  })

  test('ignores missing, blank, and relative paths', () => {
    expect(resolveUserDataPathOverride(undefined)).toBeNull()
    expect(resolveUserDataPathOverride('')).toBeNull()
    expect(resolveUserDataPathOverride('.\\relative')).toBeNull()
  })
})
