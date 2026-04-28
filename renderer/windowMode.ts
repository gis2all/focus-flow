import type { WindowMode } from './types'

export const resolveWindowMode = (search: string): WindowMode => {
  const value = new URLSearchParams(search).get('window')
  return value === 'mini' ? 'mini' : 'main'
}
