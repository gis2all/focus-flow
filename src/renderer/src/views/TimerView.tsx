import { useState, type CSSProperties, type ReactElement } from 'react'
import type { AppSettings, TimerPhase, TimerSnapshot } from '@shared/types'
import { phaseLabel } from '../appConfig'
import {
  CoffeeCupIcon,
  LoungeChairIcon,
  PauseControlIcon,
  PlayControlIcon,
  SkipNextIcon
} from '../components/AppIcons'
import { ConfirmModal } from '../components/ConfirmModal'
import { getTimerActionConfirmation, shouldConfirmTimerAction, type TimerActionConfirmationRequest } from '../timerActionConfirmation'
import { formatTimerClock } from '../viewModel'
import styles from '../App.module.css'

interface TimerViewProps {
  currentTaskTitle: string
  progressPercent: number
  settings: AppSettings
  snapshot: TimerSnapshot
  startTimer(phase: TimerPhase): Promise<void>
  updateSettings(patch: Partial<AppSettings>): Promise<void>
}

interface PrimaryTimerAction {
  action: 'start' | 'resume'
  label: string
}

export const getPrimaryTimerAction = (
  snapshot: Pick<TimerSnapshot, 'status' | 'phase'>
): PrimaryTimerAction => {
  if (snapshot.status === 'paused') {
    return {
      action: 'resume',
      label: snapshot.phase === 'focus' ? '继续专注' : '继续休息'
    }
  }

  return {
    action: 'start',
    label: '开始专注'
  }
}

export const TimerView = ({
  currentTaskTitle,
  progressPercent,
  settings,
  snapshot,
  startTimer,
  updateSettings
}: TimerViewProps): ReactElement => {
  const [confirmAction, setConfirmAction] = useState<TimerActionConfirmationRequest | null>(null)
  const [confirmPending, setConfirmPending] = useState(false)
  const autoSwitchEnabled = settings.autoStartBreaks || settings.autoStartFocus
  const [displayMinutes = '00', displaySeconds = '00'] = formatTimerClock(snapshot.remainingMs).split(':')
  const primaryAction = getPrimaryTimerAction(snapshot)
  const canPause = snapshot.status === 'running'
  const canSkip = snapshot.status === 'running' || snapshot.status === 'paused'
  const normalizedProgress = Math.min(100, Math.max(0, progressPercent))
  const timerStyle = {
    '--progress': `${normalizedProgress}%`,
    '--progress-value': `${normalizedProgress}`
  } as CSSProperties
  const longBreakInterval = Math.max(1, settings.longBreakInterval)
  const completedInCycle = snapshot.focusCount % longBreakInterval
  const longBreakProgress =
    snapshot.focusCount === 0 ? 1 : completedInCycle === 0 ? longBreakInterval : completedInCycle

  const runTimerAction = async (action: TimerActionConfirmationRequest): Promise<void> => {
    switch (action.kind) {
      case 'startFocus':
        await startTimer('focus')
        return
      case 'skip':
        await window.focusFlow.timer.skip()
        return
      case 'startShortBreak':
        await startTimer('shortBreak')
        return
      case 'startLongBreak':
        await startTimer('longBreak')
        return
      case 'startFocusWithTask':
        return
    }
  }

  const openOrRunTimerAction = (action: TimerActionConfirmationRequest): void => {
    if (shouldConfirmTimerAction(snapshot)) {
      setConfirmAction(action)
      return
    }

    void runTimerAction(action)
  }

  const handleConfirmAction = async (): Promise<void> => {
    if (!confirmAction || confirmPending) return
    setConfirmPending(true)

    try {
      await runTimerAction(confirmAction)
      setConfirmAction(null)
    } finally {
      setConfirmPending(false)
    }
  }

  const handlePrimaryAction = (): void => {
    if (primaryAction.action === 'resume') {
      void window.focusFlow.timer.resume()
      return
    }

    openOrRunTimerAction({ kind: 'startFocus' })
  }

  return (
    <div className={styles.timerView} style={timerStyle}>
      <div className={styles.timerHeader}>
        <p>
          <span className={styles.timerStatusBadge} aria-hidden="true">
            <span className={styles.timerStatusHalo} />
            <span className={styles.timerStatusCore} />
          </span>
          {phaseLabel[snapshot.phase]} · 第 {Math.max(1, snapshot.focusCount + 1)} 个番茄钟
        </p>
        <label className={styles.autoSwitch}>
          <span>自动切换专注/休息</span>
          <input
            checked={autoSwitchEnabled}
            onChange={(event) =>
              void updateSettings({ autoStartBreaks: event.target.checked, autoStartFocus: event.target.checked })
            }
            type="checkbox"
          />
        </label>
      </div>

      <div className={styles.timerHero}>
        <div className={styles.timerClockWrap}>
          <div className={styles.timerDigits}>
            <span className={styles.timerDigitsGroup}>{displayMinutes}</span>
            <span aria-hidden="true" className={styles.timerDigitsSeparator} />
            <span className={styles.timerDigitsGroup}>{displaySeconds}</span>
          </div>
        </div>
        <div className={styles.timerMetaRow}>
          <div className={styles.currentTaskCard}>
            <span>当前任务</span>
            <strong>{currentTaskTitle}</strong>
            <small>预计专注：2 个番茄钟　已专注：{snapshot.focusCount} 个番茄钟</small>
          </div>
          <div className={styles.focusDialCard}>
            <div className={styles.focusDial}>
              <svg className={styles.focusDialSvg} viewBox="0 0 100 100" aria-hidden="true">
                <circle className={styles.focusDialTrack} cx="50" cy="50" r="44" pathLength="100" />
                <circle className={styles.focusDialProgress} cx="50" cy="50" r="44" pathLength="100" />
              </svg>
              <div className={styles.focusDialContent}>
                <span>长休进度</span>
                <strong>{longBreakProgress}/{longBreakInterval}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.timerActions}>
        <button className={`${styles.timerActionButton} ${styles.startButton}`} onClick={handlePrimaryAction} type="button">
          <PlayControlIcon className={styles.timerActionIcon} />
          <b>{primaryAction.label}</b>
        </button>
        <button className={styles.timerActionButton} disabled={!canPause} onClick={() => void window.focusFlow.timer.pause()} type="button">
          <PauseControlIcon className={styles.timerActionIcon} />
          <b>暂停</b>
        </button>
        <button
          className={styles.timerActionButton}
          disabled={!canSkip}
          onClick={() => openOrRunTimerAction({ kind: 'skip' })}
          type="button"
        >
          <SkipNextIcon className={styles.timerActionIcon} />
          <b>跳过</b>
        </button>
        <button
          className={styles.timerActionButton}
          onClick={() => openOrRunTimerAction({ kind: 'startShortBreak', minutes: settings.shortBreakMinutes })}
          type="button"
        >
          <CoffeeCupIcon className={styles.timerActionIcon} />
          <b>{`短休 · ${settings.shortBreakMinutes} 分钟`}</b>
        </button>
        <button
          className={styles.timerActionButton}
          onClick={() => openOrRunTimerAction({ kind: 'startLongBreak', minutes: settings.longBreakMinutes })}
          type="button"
        >
          <LoungeChairIcon className={styles.timerActionIcon} />
          <b>{`长休 · ${settings.longBreakMinutes} 分钟`}</b>
        </button>
      </div>

      {confirmAction ? (
        <ConfirmModal
          {...getTimerActionConfirmation(confirmAction)}
          onCancel={() => !confirmPending && setConfirmAction(null)}
          onConfirm={() => void handleConfirmAction()}
          pending={confirmPending}
        />
      ) : null}
    </div>
  )
}
