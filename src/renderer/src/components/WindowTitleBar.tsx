import type { ReactElement } from 'react'
import appIconUrl from '../../../../resources/focusflow-icon.svg'
import styles from '../App.module.css'
import { CloseIcon, MaximizeIcon, MiniWindowIcon, MinimizeIcon, MoonIcon, SunIcon } from './AppIcons'

interface WindowTitleBarProps {
  activeTheme: 'light' | 'dark'
  onToggleTheme(): void
  onShowMiniWindow?(): void
}

export const WindowTitleBar = ({ activeTheme, onToggleTheme, onShowMiniWindow }: WindowTitleBarProps): ReactElement => (
  <header className={styles.titleBar}>
    <div className={styles.titleBrand}>
      <span className={styles.titleBrandMark} aria-hidden="true">
        <img alt="" src={appIconUrl} />
      </span>
      <strong>FocusFlow</strong>
    </div>
    <div className={styles.titleActions}>
      <button
        className={styles.themeToggleButton}
        onClick={onToggleTheme}
        type="button"
        aria-label={activeTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {activeTheme === 'dark' ? (
          <SunIcon className={styles.windowControlIcon} />
        ) : (
          <MoonIcon className={styles.windowControlIcon} />
        )}
      </button>
      {onShowMiniWindow ? (
        <button className={styles.miniWindowToggleButton} onClick={onShowMiniWindow} type="button" aria-label="显示小窗">
          <MiniWindowIcon className={styles.windowControlIcon} />
        </button>
      ) : null}
      <div className={styles.windowControls}>
        <button onClick={() => void window.focusFlow.system.minimizeWindow()} type="button" aria-label="Minimize window">
          <MinimizeIcon className={styles.windowControlIcon} />
        </button>
        <button onClick={() => void window.focusFlow.system.toggleMaximizeWindow()} type="button" aria-label="Maximize window">
          <MaximizeIcon className={styles.windowControlIcon} />
        </button>
        <button
          className={styles.closeWindowButton}
          onClick={() => void window.focusFlow.system.closeWindow()}
          type="button"
          aria-label="Close window"
        >
          <CloseIcon className={styles.windowControlIcon} />
        </button>
      </div>
    </div>
  </header>
)
