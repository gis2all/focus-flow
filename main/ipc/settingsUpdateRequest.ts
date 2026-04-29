import type { AppSettings } from '@shared/types'
import { isPlainObject } from '@shared/settingsValidation'

export const getSettingsUpdatePatch = (request: unknown): Partial<AppSettings> => {
  if (!isPlainObject(request)) {
    throw new Error('settings.update request must be an object')
  }

  if (!isPlainObject(request.patch)) {
    throw new Error('settings.update patch must be a plain object')
  }

  return request.patch as Partial<AppSettings>
}
