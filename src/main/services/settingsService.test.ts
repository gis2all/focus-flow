import { describe, expect, test, vi } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import type { SettingsRepository } from '@main/ports/repositories'
import { SettingsService } from './settingsService'

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
})
