import type { CSSProperties, ReactElement } from 'react'
import type { AppSettings, TimerPhase, TimerSnapshot } from '@shared/types'
import { phaseLabel } from '../appConfig'
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

  return (
    <div className={styles.timerView}>
      <div className={styles.timerHeader}>
        <p>{phaseLabel[snapshot.phase]} · 第 {Math.max(1, snapshot.focusCount + 1)} 个番茄钟</p>
        <label className={styles.autoSwitch}>
          <span>自动切换</span>
          <input
            checked={autoSwitchEnabled}
            onChange={(event) =>
              void updateSettings({ autoStartBreaks: event.target.checked, autoStartFocus: event.target.checked })
            }
            type="checkbox"
          />
          <strong>{autoSwitchEnabled ? '开' : '关'}</strong>
        </label>
      </div>

      <div className={styles.timerHero}>
        <div className={styles.timerHeroBackdrop}>
          <div className={styles.mountainLayer} />
        </div>
        <div className={styles.timerClockWrap}>
          <div className={styles.timerDigits}>
            <span className={styles.timerDigitsGroup}>{displayMinutes}</span>
            <span aria-hidden="true" className={styles.timerDigitsSeparator}>
              :
            </span>
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
            <div className={styles.focusDial} style={{ '--progress': `${progressPercent}%` } as CSSProperties}>
              <div className={styles.focusDialContent}>
                <span>长休进度</span>
                <strong>{Math.max(1, snapshot.focusCount || 1)}/4</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.timerActions}>
        <button className={styles.startButton} onClick={() => void startTimer('focus')} type="button">
          <span>▶</span>
          <b>开始</b>
        </button>
        <button
          onClick={() => void (snapshot.status === 'paused' ? window.focusFlow.timer.resume() : window.focusFlow.timer.pause())}
          type="button"
        >
          <span>{snapshot.status === 'paused' ? '▶' : 'Ⅱ'}</span>
          <b>{snapshot.status === 'paused' ? '继续' : '暂停'}</b>
        </button>
        <button onClick={() => void window.focusFlow.timer.skip()} type="button">
          <span>⏭</span>
          <b>跳过</b>
        </button>
        <button onClick={() => void startTimer('shortBreak')} type="button">
          <b>短休息</b>
          <small>{settings.shortBreakMinutes} 分钟</small>
        </button>
        <button onClick={() => void startTimer('longBreak')} type="button">
          <b>长休息</b>
          <small>{settings.longBreakMinutes} 分钟</small>
        </button>
      </div>
    </div>
  )
}
