import type { ReactElement } from 'react'
import appIconUrl from '../assets/icons/focusflow-icon.svg'
import styles from '../App.module.css'
import { CloseIcon, MaximizeIcon, MiniWindowIcon, MinimizeIcon, MoonIcon, SunIcon } from './AppIcons'

interface WindowTitleBarProps {
  activeTheme: 'light' | 'dark'
  onToggleTheme(): void
  onShowMiniWindow?(): void
}

export const WindowTitleBar = ({ activeTheme, onToggleTheme, onShowMiniWindow }: WindowTitleBarProps): ReactElement => {
  const isWeb = typeof document !== 'undefined' && document.documentElement.dataset.focusFlowWeb === 'true'
  const themeLabel = activeTheme === 'dark' ? '\u5207\u6362\u5230\u6d45\u8272\u6a21\u5f0f' : '\u5207\u6362\u5230\u6df1\u8272\u6a21\u5f0f'

  return (
    <header className={styles.titleBar}>
      <div className={styles.titleBrand}>
        <span className={styles.titleBrandMark} aria-hidden="true">
          <img alt="" src={appIconUrl} />
        </span>
        <strong>FocusFlow</strong>
      </div>
      <div className={styles.titleActions}>
        <button className={styles.themeToggleButton} onClick={onToggleTheme} type="button" aria-label={themeLabel}>
          {activeTheme === 'dark' ? (
            <SunIcon className={styles.windowControlIcon} />
          ) : (
            <MoonIcon className={styles.windowControlIcon} />
          )}
        </button>
        {!isWeb && onShowMiniWindow ? (
          <button
            className={styles.miniWindowToggleButton}
            onClick={onShowMiniWindow}
            type="button"
            aria-label={'\u663e\u793a\u5c0f\u7a97'}
          >
            <MiniWindowIcon className={styles.windowControlIcon} />
          </button>
        ) : null}
        {!isWeb ? (
          <div className={styles.windowControls}>
            <button
              onClick={() => void window.focusFlow.system.minimizeWindow()}
              type="button"
              aria-label={'\u6700\u5c0f\u5316'}
            >
              <MinimizeIcon className={styles.windowControlIcon} />
            </button>
            <button
              onClick={() => void window.focusFlow.system.toggleMaximizeWindow()}
              type="button"
              aria-label={'\u6700\u5927\u5316'}
            >
              <MaximizeIcon className={styles.windowControlIcon} />
            </button>
            <button
              className={styles.closeWindowButton}
              onClick={() => void window.focusFlow.system.closeWindow()}
              type="button"
              aria-label={'\u5173\u95ed'}
            >
              <CloseIcon className={styles.windowControlIcon} />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
