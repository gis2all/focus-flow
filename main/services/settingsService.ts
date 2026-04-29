import { numericSettingsFields, sanitizeNumericSettings, validateNumericSettingValue, isPlainObject } from '@shared/settingsValidation'
import type { AppSettings } from '@shared/types'
import type { AutoLaunchPort } from '@main/ports/desktop'
import type { SettingsRepository } from '@main/ports/repositories'

const booleanFields = [
  'autoStartBreaks',
  'autoStartFocus',
  'notificationsEnabled',
  'soundEnabled',
  'openAtLogin',
  'startToTray',
  'closeToTray'
] as const

const validateBooleanField = (value: unknown, field: (typeof booleanFields)[number]): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`${field} must be a boolean`)
  }
  return value
}

const validateThemePreference = (value: unknown): AppSettings['themePreference'] => {
  if (value === 'system' || value === 'light' || value === 'dark') {
    return value
  }
  throw new Error('themePreference must be one of system, light, dark')
}

const knownSettingsFields = [...booleanFields, ...numericSettingsFields, 'themePreference'] as const

const hasOwn = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)

export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly autoLaunch: AutoLaunchPort
  ) {}

  async get(): Promise<AppSettings> {
    const current = await this.settings.get()
    return this.sanitizeStoredSettings(current)
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    if (!isPlainObject(patch)) {
      throw new Error('settings patch must be a plain object')
    }

    for (const field of Object.keys(patch)) {
      if (!(knownSettingsFields as readonly string[]).includes(field)) {
        throw new Error(`Unknown settings field: ${field}`)
      }
    }

    const nextPatch: Partial<AppSettings> = {}
    const patchRecord = patch as Record<string, unknown>

    for (const field of booleanFields) {
      if (hasOwn(patchRecord, field)) {
        nextPatch[field] = validateBooleanField(patchRecord[field], field)
      }
    }

    for (const field of numericSettingsFields) {
      if (hasOwn(patchRecord, field)) {
        nextPatch[field] = validateNumericSettingValue(patchRecord[field], field)
      }
    }
    if (hasOwn(patchRecord, 'themePreference')) {
      nextPatch.themePreference = validateThemePreference(patchRecord.themePreference)
    }

    const updated = await this.settings.update(nextPatch)
    const sanitizedUpdated = await this.sanitizeStoredSettings(updated)

    if (hasOwn(patchRecord, 'openAtLogin') || hasOwn(patchRecord, 'startToTray')) {
      this.autoLaunch.setOpenAtLogin(sanitizedUpdated.openAtLogin, sanitizedUpdated.startToTray)
    }

    return sanitizedUpdated
  }

  private async sanitizeStoredSettings(settings: AppSettings): Promise<AppSettings> {
    const { normalized, patch } = sanitizeNumericSettings(settings as Record<(typeof numericSettingsFields)[number], unknown>)
    if (Object.keys(patch).length === 0) {
      return settings
    }

    await this.settings.update(patch)
    return {
      ...settings,
      ...normalized
    }
  }
}
