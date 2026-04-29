import { defaultSettings } from './defaults'
import type { AppSettings } from './types'

export const numericSettingsFields = [
  'focusMinutes',
  'shortBreakMinutes',
  'longBreakMinutes',
  'longBreakInterval'
] as const

export type NumericSettingField = (typeof numericSettingsFields)[number]

export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export const normalizeNumericSettingValue = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  const normalized = Math.round(value)
  return normalized < 1 ? fallback : normalized
}

export const validateNumericSettingValue = (value: unknown, field: NumericSettingField): number => {
  if (typeof value !== 'number') {
    throw new Error(`${field} must be a number`)
  }

  const normalized = Math.round(value)
  if (!Number.isFinite(normalized) || normalized < 1) {
    throw new Error(`${field} must be at least 1`)
  }

  return normalized
}

export const getNormalizedNumericSetting = (
  settings: Pick<Record<NumericSettingField, unknown>, NumericSettingField>,
  field: NumericSettingField
): number => normalizeNumericSettingValue(settings[field], defaultSettings[field])

export const sanitizeNumericSettings = (
  settings: Pick<Record<NumericSettingField, unknown>, NumericSettingField>
): {
  normalized: Pick<AppSettings, NumericSettingField>
  patch: Partial<Pick<AppSettings, NumericSettingField>>
} => {
  const normalized = {} as Pick<AppSettings, NumericSettingField>
  const patch: Partial<Pick<AppSettings, NumericSettingField>> = {}

  for (const field of numericSettingsFields) {
    const nextValue = getNormalizedNumericSetting(settings, field)
    normalized[field] = nextValue
    if (settings[field] !== nextValue) {
      patch[field] = nextValue
    }
  }

  return { normalized, patch }
}
