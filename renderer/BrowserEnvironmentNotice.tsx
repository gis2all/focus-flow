import type { ReactElement } from 'react'
import styles from './BrowserEnvironmentNotice.module.css'

export const BrowserEnvironmentNotice = (): ReactElement => (
  <main className={styles.page}>
    <section className={styles.panel}>
      <span className={styles.badge}>FocusFlow</span>
      <h1 className={styles.title}>Electron preload is not available in this browser tab.</h1>
      <p className={styles.body}>Open the desktop app from Electron to use timers, tasks, settings, and statistics.</p>
      <div className={styles.notes}>
        <p>Use <code>npm run dev</code> to launch the desktop window during development.</p>
        <p>
          The <code>http://localhost:5173/</code> page only serves the renderer bundle, so Electron APIs are unavailable here.
        </p>
      </div>
    </section>
  </main>
)
