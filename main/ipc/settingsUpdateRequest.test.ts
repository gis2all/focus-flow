import { describe, expect, test } from 'vitest'
import { getSettingsUpdatePatch } from './settingsUpdateRequest'

describe('settings update IPC request validation', () => {
  test('returns the patch from a valid request object', () => {
    expect(getSettingsUpdatePatch({ patch: { focusMinutes: 30 } })).toEqual({ focusMinutes: 30 })
  })

  test('rejects malformed request objects before they reach SettingsService', () => {
    expect(() => getSettingsUpdatePatch(undefined)).toThrow('settings.update request must be an object')
    expect(() => getSettingsUpdatePatch({ patch: null })).toThrow('settings.update patch must be a plain object')
    expect(() => getSettingsUpdatePatch({ patch: [] })).toThrow('settings.update patch must be a plain object')
    expect(() => getSettingsUpdatePatch({ patch: 42 })).toThrow('settings.update patch must be a plain object')
  })
})
