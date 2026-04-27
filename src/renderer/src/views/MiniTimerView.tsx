import type { ReactElement } from 'react'
import type { AppSettings, TimerSnapshot } from '@shared/types'
import { phaseLabel } from '../appConfig'
import styles from '../App.module.css'
import { GripDotsIcon, ReturnArrowIcon } from '../components/AppIcons'
import { formatTimerClock } from '../viewModel'

interface MiniTimerViewProps {
  activeTheme: 'light' | 'dark'
  settings: AppSettings
  snapshot: TimerSnapshot
}

const resolveMiniStatusLabel = (snapshot: Pick<TimerSnapshot, 'status' | 'phase'>): string => {
  if (snapshot.status === 'idle' || snapshot.status === 'completed') {
    return '待开始'
  }

  return phaseLabel[snapshot.phase]
}

const resolveMiniTime = (
  snapshot: Pick<TimerSnapshot, 'status' | 'remainingMs'>,
  settings: Pick<AppSettings, 'focusMinutes'>
): string => {
  if (snapshot.status === 'running' || snapshot.status === 'paused') {
    return formatTimerClock(snapshot.remainingMs)
  }

  return formatTimerClock(settings.focusMinutes * 60_000)
}

export const MiniTimerView = ({ activeTheme, settings, snapshot }: MiniTimerViewProps): ReactElement => {
  const statusLabel = resolveMiniStatusLabel(snapshot)
  const timeLabel = resolveMiniTime(snapshot, settings)
  const isRunning = snapshot.status === 'running'
  const shouldUseIconToneStatusLabel =
    snapshot.phase === 'shortBreak' && snapshot.status !== 'idle' && snapshot.status !== 'completed'
  const shouldMuteStatusLabel =
    snapshot.phase === 'longBreak' && snapshot.status !== 'idle' && snapshot.status !== 'completed'
  const [displayMinutes = '00', displaySeconds = '00'] = timeLabel.split(':')

  return (
    <section
      className={`${styles.miniWindow} ${activeTheme === 'dark' ? styles.miniWindowDark : styles.miniWindowLight}`}
    >
      <div className={styles.miniWindowShell}>
        <header className={styles.miniWindowTopBar}>
          <div className={styles.miniDragRegion} aria-label="Drag mini window">
            <GripDotsIcon className={styles.miniDragIcon} />
          </div>
          <button
            className={styles.miniReturnButton}
            onClick={() => void window.focusFlow.system.showWindow()}
            type="button"
            aria-label="Return to main window"
          >
            <ReturnArrowIcon className={styles.miniReturnIcon} />
          </button>
          <div className={styles.miniStatus}>
            <span
              className={`${styles.miniStatusBadge} ${isRunning ? styles.miniStatusBadgeRunning : ''}`}
              aria-hidden="true"
            >
              <span className={`${styles.miniStatusHalo} ${isRunning ? styles.miniStatusHaloRunning : ''}`} />
              <span className={styles.miniStatusCore} />
            </span>
            <span
              className={`${styles.miniStatusLabel} ${shouldUseIconToneStatusLabel ? styles.miniStatusLabelSubtle : ''} ${shouldMuteStatusLabel ? styles.miniStatusLabelMuted : ''}`}
            >
              {statusLabel}
            </span>
          </div>
        </header>

        <div className={styles.miniTimerBody}>
          <div className={`${styles.timerDigits} ${styles.miniTimerDigits}`}>
            <span className={styles.timerDigitsGroup}>{displayMinutes}</span>
            <span aria-hidden="true" className={styles.timerDigitsSeparator} />
            <span className={styles.timerDigitsGroup}>{displaySeconds}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
