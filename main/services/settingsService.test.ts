import { describe, expect, test, vi } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import type { SettingsRepository } from '@main/ports/repositories'
import { SettingsService } from './settingsService'

const createMutableSettingsRepository = (initialSettings: Record<string, unknown>) => {
  const updates: Partial<Record<keyof typeof defaultSettings, unknown>>[] = []
  const stored: Record<string, unknown> = { ...initialSettings }
  const repository: SettingsRepository = {
    get: async () => ({ ...stored } as typeof defaultSettings),
    update: async (patch) => {
      updates.push({ ...patch })
      Object.assign(stored, patch)
      return { ...stored } as typeof defaultSettings
    }
  }

  return { repository, stored, updates }
}

describe('SettingsService', () => {
  test('normalizes timer numbers before persisting', async () => {
    const settingsRepository: SettingsRepository = {
      get: async () => defaultSettings,
      update: async (patch) => ({ ...defaultSettings, ...patch })
    }
    const autoLaunch = { setOpenAtLogin: vi.fn() }
    const service = new SettingsService(settingsRepository, autoLaunch)

    const updated = await service.update({ focusMinutes: 50.2, longBreakInterval: 4.4 })

    expect(updated.focusMinutes).toBe(50)
    expect(updated.longBreakInterval).toBe(4)
  })

  test('rejects non-positive timer values', async () => {
    const settingsRepository: SettingsRepository = {
      get: async () => defaultSettings,
      update: async (patch) => ({ ...defaultSettings, ...patch })
    }
    const autoLaunch = { setOpenAtLogin: vi.fn() }
    const service = new SettingsService(settingsRepository, autoLaunch)

    await expect(service.update({ shortBreakMinutes: 0 })).rejects.toThrow('shortBreakMinutes must be at least 1')
  })

  test('rejects malformed numeric timer payloads from renderer IPC', async () => {
    const settingsRepository: SettingsRepository = {
      get: async () => defaultSettings,
      update: async (patch) => ({ ...defaultSettings, ...patch })
    }
    const autoLaunch = { setOpenAtLogin: vi.fn() }
    const service = new SettingsService(settingsRepository, autoLaunch)

    await expect(service.update({ focusMinutes: '25' as never })).rejects.toThrow('focusMinutes must be a number')
    await expect(service.update({ shortBreakMinutes: null as never })).rejects.toThrow('shortBreakMinutes must be a number')
    await expect(service.update({ longBreakMinutes: { minutes: 15 } as never })).rejects.toThrow(
      'longBreakMinutes must be a number'
    )
    await expect(service.update({ longBreakInterval: Number.NaN })).rejects.toThrow('longBreakInterval must be at least 1')
    await expect(service.update({ focusMinutes: Number.POSITIVE_INFINITY })).rejects.toThrow(
      'focusMinutes must be at least 1'
    )
  })

  test('rejects invalid theme preferences from renderer payloads', async () => {
    const settingsRepository: SettingsRepository = {
      get: async () => defaultSettings,
      update: async (patch) => ({ ...defaultSettings, ...patch })
    }
    const autoLaunch = { setOpenAtLogin: vi.fn() }
    const service = new SettingsService(settingsRepository, autoLaunch)

    await expect(service.update({ themePreference: 'neon' as never })).rejects.toThrow(
      'themePreference must be one of system, light, dark'
    )
  })

  test('rejects non-boolean toggle payloads from renderer IPC', async () => {
    const settingsRepository: SettingsRepository = {
      get: async () => defaultSettings,
      update: async (patch) => ({ ...defaultSettings, ...patch })
    }
    const autoLaunch = { setOpenAtLogin: vi.fn() }
    const service = new SettingsService(settingsRepository, autoLaunch)

    await expect(service.update({ closeToTray: 'yes' as never })).rejects.toThrow('closeToTray must be a boolean')
    await expect(service.update({ openAtLogin: 1 as never })).rejects.toThrow('openAtLogin must be a boolean')
  })

  test('self-heals persisted numeric settings on read and writes the sanitized values back', async () => {
    const { repository, updates } = createMutableSettingsRepository({
      ...defaultSettings,
      focusMinutes: '25',
      shortBreakMinutes: 0,
      longBreakMinutes: Number.POSITIVE_INFINITY,
      longBreakInterval: 3.6
    })
    const autoLaunch = { setOpenAtLogin: vi.fn() }
    const service = new SettingsService(repository, autoLaunch)

    await expect(service.get()).resolves.toEqual({
      ...defaultSettings,
      focusMinutes: 25,
      shortBreakMinutes: defaultSettings.shortBreakMinutes,
      longBreakMinutes: defaultSettings.longBreakMinutes,
      longBreakInterval: 4
    })
    expect(updates).toEqual([
      {
        focusMinutes: 25,
        shortBreakMinutes: defaultSettings.shortBreakMinutes,
        longBreakMinutes: defaultSettings.longBreakMinutes,
        longBreakInterval: 4
      }
    ])
  })

  test('returns sanitized settings after update even when storage still contains older dirty numeric values', async () => {
    const { repository, updates } = createMutableSettingsRepository({
      ...defaultSettings,
      shortBreakMinutes: '5',
      longBreakMinutes: 0
    })
    const autoLaunch = { setOpenAtLogin: vi.fn() }
    const service = new SettingsService(repository, autoLaunch)

    await expect(service.update({ focusMinutes: 30.2 })).resolves.toEqual({
      ...defaultSettings,
      focusMinutes: 30,
      shortBreakMinutes: defaultSettings.shortBreakMinutes,
      longBreakMinutes: defaultSettings.longBreakMinutes
    })
    expect(updates).toEqual([
      { focusMinutes: 30 },
      {
        shortBreakMinutes: defaultSettings.shortBreakMinutes,
        longBreakMinutes: defaultSettings.longBreakMinutes
      }
    ])
  })
})
