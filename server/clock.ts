import type { ClockPort } from '@main/ports/desktop'

export class ServerClock implements ClockPort {
  now(): number {
    return Date.now()
  }

  nowIso(): string {
    return new Date().toISOString()
  }
}
