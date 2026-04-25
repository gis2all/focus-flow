import type { ReactElement, ReactNode } from 'react'
import { navItems } from '../appConfig'
import type { ViewKey } from '../types'
import styles from '../App.module.css'
import { SettingsIcon, StatsIcon, TasksIcon, TimerIcon } from './AppIcons'
import { WindowTitleBar } from './WindowTitleBar'

interface AppShellProps {
  activeTheme: 'light' | 'dark'
  activeView: ViewKey
  children: ReactNode
  onNavigate(view: ViewKey): void
  onToggleTheme(): void
}

export const AppShell = ({
  activeTheme,
  activeView,
  children,
  onNavigate,
  onToggleTheme
}: AppShellProps): ReactElement => {
  const renderNavIcon = (view: ViewKey): ReactElement => {
    if (view === 'timer') return <TimerIcon className={styles.navIcon} />
    if (view === 'tasks') return <TasksIcon className={styles.navIcon} />
    if (view === 'stats') return <StatsIcon className={styles.navIcon} />
    return <SettingsIcon className={styles.navIcon} />
  }

  return (
    <div className={styles.appFrame}>
      <WindowTitleBar activeTheme={activeTheme} onToggleTheme={onToggleTheme} />

      <aside className={styles.sideRail}>
        <nav className={styles.primaryNav}>
          {navItems.map((item) => (
            <button
              className={`${styles.navItem} ${activeView === item.key ? styles.navItemActive : ''}`}
              key={item.key}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              {renderNavIcon(item.key)}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className={styles.appSurface}>{children}</main>
    </div>
  )
}
