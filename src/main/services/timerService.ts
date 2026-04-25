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
import type { AppSettings, CompletionReason, TimerPhase, TimerSession, TimerSnapshot, TimerState } from '@shared/types'
import type { ClockPort, NotificationPort, SoundPort } from '@main/ports/desktop'
import type {
  AppEventRepository,
  SettingsRepository,
  TaskRepository,
  TimerRuntimeRepository,
  TimerSessionRepository
} from '@main/ports/repositories'

export interface TimerServiceDependencies {
  sessions: TimerSessionRepository
  settings: SettingsRepository
  runtime: TimerRuntimeRepository
  events: AppEventRepository
  tasks: Pick<TaskRepository, 'list'>
  clock: ClockPort
  notifier: NotificationPort
  sound: SoundPort
}

export interface StartTimerCommand {
  phase?: TimerPhase
  taskId?: string | null
}

const isTimerPhase = (value: unknown): value is TimerPhase =>
  value === 'focus' || value === 'shortBreak' || value === 'longBreak'

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
    this.state = {
      ...restore.state,
      focusCount: await this.getRestoredFocusCount(activeSession)
    }

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
    const requestedPhase = command.phase ?? 'focus'
    if (!isTimerPhase(requestedPhase)) {
      throw new Error(`Invalid timer phase: ${String(requestedPhase)}`)
    }
    const phase = requestedPhase
    const now = this.dependencies.clock.now()
    const taskId = phase === 'focus' ? await this.resolveExplicitFocusTaskId(command.taskId) : null

    await this.finishCurrentSession('abandoned')

    const session = await this.dependencies.sessions.create({
      phase,
      taskId,
      startedAt: this.dependencies.clock.nowIso(),
      durationMs: phaseDurationMs(phase, settings)
    })

    this.state = startTimer(this.requireState(), {
      now,
      phase,
      taskId,
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

  async bindCurrentTask(taskId: string | null): Promise<TimerSnapshot> {
    const state = this.requireState()
    if (state.status !== 'running' || state.phase !== 'focus' || !state.sessionId) {
      throw new Error('Current timer is not a running focus session')
    }

    const resolvedTaskId = await this.resolveExplicitFocusTaskId(taskId)
    const now = this.dependencies.clock.now()
    const nowIso = this.dependencies.clock.nowIso()

    await this.dependencies.sessions.updateTask({
      id: state.sessionId,
      taskId: resolvedTaskId,
      updatedAt: nowIso
    })

    this.state = {
      ...state,
      taskId: resolvedTaskId,
      updatedAt: now
    }
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
      return this.start({ phase: nextPhase, taskId: nextPhase === 'focus' ? undefined : null })
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

  private async resolveExplicitFocusTaskId(taskId: string | null | undefined): Promise<string | null> {
    if (taskId === undefined || taskId === null) {
      return null
    }

    const activeTask = (await this.dependencies.tasks.list()).find((task) => task.id === taskId && !task.completedAt)
    if (!activeTask) {
      throw new Error('Selected task must be active')
    }

    return taskId
  }

  private async requireSettings(): Promise<AppSettings> {
    if (!this.settingsValue) {
      this.settingsValue = await this.dependencies.settings.get()
    }
    return this.settingsValue
  }

  private async persistState(): Promise<void> {
    try {
      await this.dependencies.runtime.save(this.requireState())
    } catch {
      // Keep the in-memory timer running even when runtime persistence is temporarily unavailable.
    }
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

  private async getRestoredFocusCount(activeSession: TimerSession): Promise<number> {
    const sessions = await this.dependencies.sessions.list()
    const activeStartedAt = new Date(activeSession.startedAt).getTime()

    return sessions.filter((session) => {
      if (session.id === activeSession.id) return false
      if (session.phase !== 'focus' || !session.completed) return false
      return new Date(session.startedAt).getTime() < activeStartedAt
    }).length
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
