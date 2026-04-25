import type { AppSettings } from '@shared/types'
import type { AutoLaunchPort } from '@main/ports/desktop'
import type { SettingsRepository } from '@main/ports/repositories'

const normalizePositiveInteger = (value: number, field: string): number => {
  const normalized = Math.round(value)
  if (!Number.isFinite(normalized) || normalized < 1) {
    throw new Error(`${field} must be at least 1`)
  }
  return normalized
}

export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly autoLaunch: AutoLaunchPort
  ) {}

  get(): Promise<AppSettings> {
    return this.settings.get()
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const nextPatch: Partial<AppSettings> = { ...patch }

    if (typeof patch.focusMinutes === 'number') {
      nextPatch.focusMinutes = normalizePositiveInteger(patch.focusMinutes, 'focusMinutes')
    }
    if (typeof patch.shortBreakMinutes === 'number') {
      nextPatch.shortBreakMinutes = normalizePositiveInteger(patch.shortBreakMinutes, 'shortBreakMinutes')
    }
    if (typeof patch.longBreakMinutes === 'number') {
      nextPatch.longBreakMinutes = normalizePositiveInteger(patch.longBreakMinutes, 'longBreakMinutes')
    }
    if (typeof patch.longBreakInterval === 'number') {
      nextPatch.longBreakInterval = normalizePositiveInteger(patch.longBreakInterval, 'longBreakInterval')
    }

    const updated = await this.settings.update(nextPatch)

    if ('openAtLogin' in patch || 'startToTray' in patch) {
      this.autoLaunch.setOpenAtLogin(updated.openAtLogin, updated.startToTray)
    }

    return updated
  }
}
