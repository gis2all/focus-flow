import type { ReactElement } from 'react'
import type { AppSettings, ThemePreference } from '@shared/types'
import { settingLabels, settingsSections } from '../appConfig'
import styles from '../App.module.css'

interface SettingsViewProps {
  activeTheme: 'light' | 'dark'
  settings: AppSettings
  updateSettings(patch: Partial<AppSettings>): Promise<void>
}

export const SettingsView = ({ activeTheme, settings, updateSettings }: SettingsViewProps): ReactElement => (
  <div className={styles.settingsView}>
    <aside className={styles.settingsTabs}>
      {settingsSections.map((section, index) => (
        <button className={index === 0 ? styles.settingsTabActive : ''} key={section} type="button">
          {section}
        </button>
      ))}
    </aside>

    <section className={styles.settingsBody}>
      <div className={styles.settingsPanel}>
      <div className={styles.settingsGroup}>
        <h2>常规</h2>
        {settingLabels.map(([key, label]) => (
          <label className={styles.settingLine} key={key}>
            <span>{label}</span>
            <input
              checked={Boolean(settings[key])}
              onChange={(event) => void updateSettings({ [key]: event.target.checked } as Partial<AppSettings>)}
              type="checkbox"
            />
          </label>
        ))}
      </div>

      <div className={styles.settingsGroup}>
        <h2>计时默认行为</h2>
        <label className={styles.settingLine}>
          <span>完成专注后</span>
          <select value={settings.autoStartBreaks ? 'autoBreak' : 'manualBreak'} onChange={(event) => void updateSettings({ autoStartBreaks: event.target.value === 'autoBreak' })}>
            <option value="manualBreak">由用户入场休息</option>
            <option value="autoBreak">自动进入休息</option>
          </select>
        </label>
        <label className={styles.settingLine}>
          <span>完成短休后</span>
          <select value={settings.autoStartFocus ? 'autoFocus' : 'manualFocus'} onChange={(event) => void updateSettings({ autoStartFocus: event.target.value === 'autoFocus' })}>
            <option value="manualFocus">由用户入场专注</option>
            <option value="autoFocus">自动进入专注</option>
          </select>
        </label>
        <label className={styles.settingLine}>
          <span>完成长休后</span>
          <select value={settings.autoStartFocus ? 'autoFocus' : 'manualFocus'} onChange={(event) => void updateSettings({ autoStartFocus: event.target.value === 'autoFocus' })}>
            <option value="manualFocus">由用户入场专注</option>
            <option value="autoFocus">自动进入专注</option>
          </select>
        </label>
      </div>

      <div className={styles.settingsGroup}>
        <h2>计时设置</h2>
        {[
          ['focusMinutes', '专注时长'],
          ['shortBreakMinutes', '短休息时长'],
          ['longBreakMinutes', '长休息时长'],
          ['longBreakInterval', '长休息间隔']
        ].map(([key, label]) => (
          <label className={styles.settingLine} key={key}>
            <span>{label}</span>
            <input
              min={1}
              onChange={(event) => void updateSettings({ [key]: Number(event.target.value) } as Partial<AppSettings>)}
              type="number"
              value={settings[key as keyof AppSettings] as number}
            />
          </label>
        ))}
      </div>

      <div className={styles.settingsGroup}>
        <h2>其他</h2>
        <label className={styles.settingLine}>
          <span>主题模式</span>
          <select
            onChange={(event) => void updateSettings({ themePreference: event.target.value as ThemePreference })}
            value={settings.themePreference}
          >
            <option value="system">跟随系统</option>
            <option value="light">白天模式</option>
            <option value="dark">黑暗模式</option>
          </select>
        </label>
        <p>当前显示：{activeTheme === 'dark' ? '黑暗模式' : '白天模式'}</p>
      </div>
      </div>
    </section>
  </div>
)
