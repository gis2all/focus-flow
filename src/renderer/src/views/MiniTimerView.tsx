import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import type { WindowDragRequest } from '@shared/contracts'
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

const toWindowDragRequest = (event: Pick<PointerEvent, 'screenX' | 'screenY'>): WindowDragRequest => ({
  pointerScreenX: event.screenX,
  pointerScreenY: event.screenY
})

export const MiniTimerView = ({ activeTheme, settings, snapshot }: MiniTimerViewProps): ReactElement => {
  const activeDragPointerIdRef = useRef<number | null>(null)
  const statusLabel = resolveMiniStatusLabel(snapshot)
  const timeLabel = resolveMiniTime(snapshot, settings)
  const isRunning = snapshot.status === 'running'
  const shouldUseIconToneStatusLabel =
    snapshot.phase === 'shortBreak' && snapshot.status !== 'idle' && snapshot.status !== 'completed'
  const shouldMuteStatusLabel =
    snapshot.phase === 'longBreak' && snapshot.status !== 'idle' && snapshot.status !== 'completed'
  const [displayMinutes = '00', displaySeconds = '00'] = timeLabel.split(':')

  useEffect(() => {
    const stopWindowDrag = (pointerId?: number): void => {
      if (activeDragPointerIdRef.current === null) return
      if (pointerId !== undefined && activeDragPointerIdRef.current !== pointerId) return

      activeDragPointerIdRef.current = null
      window.focusFlow.system.endWindowDrag()
    }

    const handlePointerMove = (event: PointerEvent): void => {
      if (activeDragPointerIdRef.current !== event.pointerId) return
      window.focusFlow.system.updateWindowDrag(toWindowDragRequest(event))
    }

    const handlePointerUp = (event: PointerEvent): void => {
      stopWindowDrag(event.pointerId)
    }

    const handlePointerCancel = (event: PointerEvent): void => {
      stopWindowDrag(event.pointerId)
    }

    const handleWindowBlur = (): void => {
      stopWindowDrag()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('blur', handleWindowBlur)
      stopWindowDrag()
    }
  }, [])

  const handleDragPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return

    activeDragPointerIdRef.current = event.pointerId
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture can fail during rapid re-renders; dragging still works via window listeners.
    }
    window.focusFlow.system.beginWindowDrag(toWindowDragRequest(event.nativeEvent))
  }

  return (
    <section
      className={`${styles.miniWindow} ${activeTheme === 'dark' ? styles.miniWindowDark : styles.miniWindowLight}`}
    >
      <div className={styles.miniWindowShell}>
        <header className={styles.miniWindowTopBar}>
          <div className={styles.miniDragRegion} aria-label="拖动小窗" onPointerDown={handleDragPointerDown}>
            <GripDotsIcon className={styles.miniDragIcon} />
          </div>
          <button
            className={styles.miniReturnButton}
            onClick={() => void window.focusFlow.system.showWindow()}
            type="button"
            aria-label="返回主窗口"
          >
            <ReturnArrowIcon className={styles.miniReturnIcon} />
          </button>
          <div className={styles.miniStatus}>
            <span
              className={`${styles.miniStatusBadge} ${isRunning ? styles.miniStatusBadgeRunning : ''}`}
              aria-hidden="true"
            >
              <span className={`${styles.miniStatusHalo} ${isRunning ? styles.miniStatusHaloRunning : ''}`} />
              <span className={`${styles.miniStatusCore} ${isRunning ? styles.miniStatusCoreRunning : ''}`} />
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
