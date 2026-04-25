import { EventEmitter } from 'node:events'
import {
  completeTimer,
  createIdleTimer,
  deriveTimerSnapshot,
  getNextPhase,
  pauseTimer,
  phaseDurationMs,
  restoreTimerFromSession,
  resumeTimer,
  startTimer
} from '@core/timer/timerState'
import type { AppSettings, CompletionReason, TimerPhase, TimerSnapshot, TimerState } from '@shared/types'
import type { ClockPort, NotificationPort, SoundPort } from '@main/ports/desktop'
import type { AppEventRepository, SettingsRepository, TimerRuntimeRepository, TimerSessionRepository } from '@main/ports/repositories'

export interface TimerServiceDependencies {
  sessions: TimerSessionRepository
  settings: SettingsRepository
  runtime: TimerRuntimeRepository
  events: AppEventRepository
  clock: ClockPort
  notifier: NotificationPort
  sound: SoundPort
}

export interface StartTimerCommand {
  phase?: TimerPhase
  taskId?: string | null
}

export class TimerService {
  private readonly emitter = new EventEmitter()
  private settingsValue: AppSettings | null = null
  private state: TimerState | null = null

  constructor(private readonly dependencies: TimerServiceDependencies) {}

  async initialize(): Promise<TimerSnapshot> {
    const settings = await this.dependencies.settings.get()
    this.settingsValue = settings
    const now = this.dependencies.clock.now()
    const runtimeState = await this.dependencies.runtime.get()

    if (runtimeState) {
      const snapshot = deriveTimerSnapshot(runtimeState, now)
      this.state = {
        ...runtimeState,
        status: snapshot.status,
        remainingMs: snapshot.remainingMs,
        updatedAt: now
      }

      if (runtimeState.status === 'running') {
        const action = snapshot.status === 'completed' ? 'needs-confirmation' : 'resume'
        await this.dependencies.events.record(
          'timer.restore',
          {
            action,
            sessionId: runtimeState.sessionId
          },
          this.dependencies.clock.nowIso()
        )

        if (snapshot.status === 'completed' && runtimeState.sessionId) {
          await this.dependencies.sessions.finish({
            id: runtimeState.sessionId,
            endedAt: this.dependencies.clock.nowIso(),
            actualDurationMs: runtimeState.durationMs,
            completed: false,
            completionReason: 'needs-confirmation'
          })
        }
      }

      await this.persistState()
      return this.publish()
    }

    const activeSession = await this.dependencies.sessions.findActive()

    if (!activeSession) {
      this.state = createIdleTimer(settings, now)
      await this.persistState()
      return this.publish()
    }

    const restore = restoreTimerFromSession({
      session: activeSession,
      now
    })
    this.state = restore.state

    await this.dependencies.events.record(
      'timer.restore',
      {
        action: restore.action,
        sessionId: activeSession.id
      },
      this.dependencies.clock.nowIso()
    )

    if (restore.action === 'needs-confirmation') {
      await this.dependencies.sessions.finish({
        id: activeSession.id,
        endedAt: this.dependencies.clock.nowIso(),
        actualDurationMs: activeSession.durationMs,
        completed: false,
        completionReason: 'needs-confirmation'
      })
    }

    await this.persistState()
    return this.publish()
  }

  async start(command: StartTimerCommand = {}): Promise<TimerSnapshot> {
    const settings = await this.requireSettings()
    const phase = command.phase ?? 'focus'
    const now = this.dependencies.clock.now()

    await this.finishCurrentSession('abandoned')

    const session = await this.dependencies.sessions.create({
      phase,
      taskId: command.taskId ?? null,
      startedAt: this.dependencies.clock.nowIso(),
      durationMs: phaseDurationMs(phase, settings)
    })

    this.state = startTimer(this.requireState(), {
      now,
      phase,
      taskId: command.taskId ?? null,
      sessionId: session.id,
      settings
    })

    await this.persistState()
    return this.publish()
  }

  async pause(): Promise<TimerSnapshot> {
    this.state = pauseTimer(this.requireState(), this.dependencies.clock.now())
    await this.persistState()
    return this.publish()
  }

  async resume(): Promise<TimerSnapshot> {
    this.state = resumeTimer(this.requireState(), this.dependencies.clock.now())
    await this.persistState()
    return this.publish()
  }

  async skip(): Promise<TimerSnapshot> {
    await this.finishCurrentSession('skipped')
    this.state = createIdleTimer(await this.requireSettings(), this.dependencies.clock.now())
    await this.persistState()
    return this.publish()
  }

  async reset(): Promise<TimerSnapshot> {
    await this.finishCurrentSession('abandoned')
    this.state = createIdleTimer(await this.requireSettings(), this.dependencies.clock.now())
    await this.persistState()
    return this.publish()
  }

  async applySettings(settings: AppSettings): Promise<TimerSnapshot> {
    this.settingsValue = settings

    const state = this.requireState()
    if (state.status === 'idle') {
      this.state = createIdleTimer(settings, this.dependencies.clock.now())
    }

    await this.persistState()
    return this.publish()
  }

  async tick(): Promise<TimerSnapshot> {
    const state = this.requireState()
    const snapshot = deriveTimerSnapshot(state, this.dependencies.clock.now())

    if (state.status !== 'running' || snapshot.status !== 'completed') {
      return this.publish(snapshot)
    }

    const completedState = completeTimer(state, this.dependencies.clock.now())
    this.state = completedState

    if (state.sessionId) {
      await this.dependencies.sessions.finish({
        id: state.sessionId,
        endedAt: this.dependencies.clock.nowIso(),
        actualDurationMs: state.durationMs,
        completed: true,
        completionReason: 'completed'
      })
    }

    const completedSnapshot = deriveTimerSnapshot(completedState, this.dependencies.clock.now())
    await this.playDesktopFeedback(completedSnapshot)

    const settings = await this.requireSettings()
    const nextPhase = getNextPhase(state.phase, completedState.focusCount, settings)
    const shouldAutoStart = state.phase === 'focus' ? settings.autoStartBreaks : settings.autoStartFocus

    if (shouldAutoStart) {
      return this.start({ phase: nextPhase, taskId: state.phase === 'focus' ? null : state.taskId })
    }

    await this.persistState()
    return this.publish(completedSnapshot)
  }

  getSnapshot(): TimerSnapshot {
    return deriveTimerSnapshot(this.requireState(), this.dependencies.clock.now())
  }

  onSnapshot(listener: (snapshot: TimerSnapshot) => void): () => void {
    this.emitter.on('snapshot', listener)
    return () => this.emitter.off('snapshot', listener)
  }

  private async playDesktopFeedback(snapshot: TimerSnapshot): Promise<void> {
    const settings = await this.requireSettings()
    if (settings.notificationsEnabled) {
      await this.dependencies.notifier.showTimerFinished(snapshot)
    }
    if (settings.soundEnabled) {
      await this.dependencies.sound.playTimerFinished()
    }
  }

  private async requireSettings(): Promise<AppSettings> {
    if (!this.settingsValue) {
      this.settingsValue = await this.dependencies.settings.get()
    }
    return this.settingsValue
  }

  private async persistState(): Promise<void> {
    await this.dependencies.runtime.save(this.requireState())
  }

  private async finishCurrentSession(reason: Exclude<CompletionReason, 'completed' | 'needs-confirmation'>): Promise<void> {
    const state = this.requireState()
    if (!state.sessionId) return
    if (state.status !== 'running' && state.status !== 'paused') return

    const snapshot = deriveTimerSnapshot(state, this.dependencies.clock.now())
    await this.dependencies.sessions.finish({
      id: state.sessionId,
      endedAt: this.dependencies.clock.nowIso(),
      actualDurationMs: state.durationMs - snapshot.remainingMs,
      completed: false,
      completionReason: reason
    })
  }

  private requireState(): TimerState {
    if (!this.state) {
      throw new Error('TimerService has not been initialized')
    }
    return this.state
  }

  private publish(snapshot = deriveTimerSnapshot(this.requireState(), this.dependencies.clock.now())): TimerSnapshot {
    this.emitter.emit('snapshot', snapshot)
    return snapshot
  }
}
