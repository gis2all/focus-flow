import { isAbsolute } from 'node:path'

export const resolveUserDataPathOverride = (value: string | undefined): string | null => {
  if (!value || !isAbsolute(value)) return null
  return value
}
