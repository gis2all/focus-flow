import type { CSSProperties, ReactElement } from 'react'
import type { AppSettings, TimerPhase, TimerSnapshot } from '@shared/types'
import { phaseLabel } from '../appConfig'
import {
  CoffeeCupIcon,
  LoungeChairIcon,
  PauseControlIcon,
  PlayControlIcon,
  SkipNextIcon
} from '../components/AppIcons'
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

  const handlePrimaryAction = (): void => {
    if (primaryAction.action === 'resume') {
      void window.focusFlow.timer.resume()
      return
    }

    void startTimer('focus')
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
          <p className={styles.timerQuote}>“沉浸专注，时间为你而在”</p>
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
        <button className={styles.timerActionButton} disabled={!canSkip} onClick={() => void window.focusFlow.timer.skip()} type="button">
          <SkipNextIcon className={styles.timerActionIcon} />
          <b>跳过</b>
        </button>
        <button className={styles.timerActionButton} onClick={() => void startTimer('shortBreak')} type="button">
          <CoffeeCupIcon className={styles.timerActionIcon} />
          <b>{`短休 · ${settings.shortBreakMinutes} 分钟`}</b>
        </button>
        <button className={styles.timerActionButton} onClick={() => void startTimer('longBreak')} type="button">
          <LoungeChairIcon className={styles.timerActionIcon} />
          <b>{`长休 · ${settings.longBreakMinutes} 分钟`}</b>
        </button>
      </div>
    </div>
  )
}
