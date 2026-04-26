import { useState, type FocusEvent, type KeyboardEvent, type ReactElement } from 'react'
import type { AppSettings, ThemePreference } from '@shared/types'
import {
  SettingsBedIcon,
  SettingsBellIcon,
  SettingsClockIcon,
  SettingsCupIcon,
  SettingsMoonIcon,
  SettingsRefreshIcon,
  SettingsUserIcon,
  SettingsVolumeIcon,
  SettingsWindowIcon
} from '../components/AppIcons'
import styles from '../App.module.css'

interface SettingsViewProps {
  activeTheme: 'light' | 'dark'
  settings: AppSettings
  updateSettings(patch: Partial<AppSettings>): Promise<void>
}

type SelectOption<T extends string> = {
  label: string
  value: T
}

type StepperDirection = 'up' | 'down'

type NumericSettingKey = 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakInterval'

type SettingIconComponent = (props: { className?: string }) => ReactElement

export const getNextStepperValue = (value: number, direction: StepperDirection): number =>
  Math.max(1, direction === 'up' ? value + 1 : value - 1)

export const parseStepperDraft = (draft: string, fallback: number): number => {
  const trimmed = draft.trim()
  if (!trimmed) return fallback
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.round(value))
}

const manualBreakOptions: Array<SelectOption<'manualBreak' | 'autoBreak'>> = [
  { value: 'manualBreak', label: '由用户入场休息' },
  { value: 'autoBreak', label: '自动进入休息' }
]

const manualFocusOptions: Array<SelectOption<'manualFocus' | 'autoFocus'>> = [
  { value: 'manualFocus', label: '由用户入场专注' },
  { value: 'autoFocus', label: '自动进入专注' }
]

const themeOptions: Array<SelectOption<ThemePreference>> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '白天模式' },
  { value: 'dark', label: '黑暗模式' }
]

const timerSteppers: Array<{ key: NumericSettingKey; label: string; unit: string; icon: SettingIconComponent }> = [
  { key: 'focusMinutes', label: '专注时长', unit: '分钟', icon: SettingsClockIcon },
  { key: 'shortBreakMinutes', label: '短休时长', unit: '分钟', icon: SettingsCupIcon },
  { key: 'longBreakMinutes', label: '长休时长', unit: '分钟', icon: SettingsBedIcon },
  { key: 'longBreakInterval', label: '长休间隔', unit: '轮', icon: SettingsRefreshIcon }
]

const SettingIdentity = ({
  icon: Icon,
  label
}: {
  icon: SettingIconComponent
  label: string
}): ReactElement => (
  <>
    <span className={styles.settingIconBox}>
      <Icon className={styles.settingIconSvg} />
    </span>
    <span className={styles.settingCopy}>
      <span className={styles.settingLabel}>{label}</span>
    </span>
  </>
)

interface SettingSwitchProps {
  checked: boolean
  icon: SettingIconComponent
  label: string
  onChange(value: boolean): void
}

const SettingSwitch = ({ checked, icon, label, onChange }: SettingSwitchProps): ReactElement => (
  <label className={styles.settingLine}>
    <SettingIdentity icon={icon} label={label} />
    <input
      checked={checked}
      className={styles.settingSwitchInput}
      onChange={(event) => onChange(event.target.checked)}
      type="checkbox"
    />
    <span aria-hidden="true" className={styles.settingSwitchTrack}>
      <span />
    </span>
  </label>
)

interface SettingSelectProps<T extends string> {
  icon: SettingIconComponent
  label: string
  options: Array<SelectOption<T>>
  value: T
  onChange(value: T): void
}

const SettingSelect = <T extends string>({
  icon,
  label,
  options,
  value,
  onChange
}: SettingSelectProps<T>): ReactElement => {
  const [isOpen, setIsOpen] = useState(false)
  const selected = options.find((option) => option.value === value) ?? options[0]

  const closeOnFocusLeave = (event: FocusEvent<HTMLDivElement>): void => {
    const nextTarget = event.relatedTarget as Node | null
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsOpen(false)
    }
  }

  return (
    <div className={styles.settingLine}>
      <SettingIdentity icon={icon} label={label} />
      <div className={styles.settingsSelect} onBlur={closeOnFocusLeave}>
        <button
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={`${styles.settingsSelectButton} ${isOpen ? styles.settingsSelectButtonOpen : ''}`}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span>{selected.label}</span>
          <span aria-hidden="true" className={styles.settingsSelectChevron}>
            ▼
          </span>
        </button>
        {isOpen ? (
          <div className={styles.settingsSelectMenu} role="listbox">
            {options.map((option) => (
              <button
                aria-selected={option.value === value}
                className={`${styles.settingsSelectOption} ${
                  option.value === value ? styles.settingsSelectOptionActive : ''
                }`}
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                role="option"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface SettingStepperProps {
  icon: SettingIconComponent
  label: string
  unit: string
  value: number
  onChange(value: number): void
}

const SettingStepper = ({ icon, label, unit, value, onChange }: SettingStepperProps): ReactElement => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(`${value}`)

  const saveDraft = (): void => {
    const nextValue = parseStepperDraft(draft, value)
    setIsEditing(false)
    setDraft(`${nextValue}`)
    if (nextValue !== value) {
      onChange(nextValue)
    }
  }

  const cancelDraft = (): void => {
    setIsEditing(false)
    setDraft(`${value}`)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveDraft()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelDraft()
    }
  }

  return (
    <div className={styles.settingLine}>
      <SettingIdentity icon={icon} label={label} />
      <div className={styles.settingStepper}>
        {isEditing ? (
          <input
            autoFocus
            className={styles.stepperEditInput}
            inputMode="numeric"
            onBlur={saveDraft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            type="text"
            value={draft}
          />
        ) : (
          <button
            className={styles.stepperValueButton}
            onClick={() => {
              setDraft(`${value}`)
              setIsEditing(true)
            }}
            type="button"
          >
            {value} {unit}
          </button>
        )}
        <span className={styles.stepperButtons}>
          <button
            aria-label={`增加${label}`}
            onClick={() => onChange(getNextStepperValue(value, 'up'))}
            type="button"
          >
            ▲
          </button>
          <button
            aria-label={`减少${label}`}
            disabled={value <= 1}
            onClick={() => onChange(getNextStepperValue(value, 'down'))}
            type="button"
          >
            ▼
          </button>
        </span>
      </div>
    </div>
  )
}

export const SettingsView = ({ settings, updateSettings }: SettingsViewProps): ReactElement => (
  <div className={styles.settingsView}>
    <section className={styles.settingsBody}>
      <div className={styles.settingsPanel}>
        <div className={styles.settingsGroup}>
          <h2>基础体验</h2>
          <SettingSwitch
            checked={settings.notificationsEnabled}
            icon={SettingsBellIcon}
            label="显示系统通知"
            onChange={(value) => void updateSettings({ notificationsEnabled: value })}
          />
          <SettingSwitch
            checked={settings.soundEnabled}
            icon={SettingsVolumeIcon}
            label="播放提示音"
            onChange={(value) => void updateSettings({ soundEnabled: value })}
          />
          <SettingSwitch
            checked={settings.closeToTray}
            icon={SettingsWindowIcon}
            label="关闭窗口后继续运行"
            onChange={(value) => void updateSettings({ closeToTray: value })}
          />
        </div>

        <div className={styles.settingsGroup}>
          <h2>计时节奏</h2>
          {timerSteppers.map((item) => (
            <SettingStepper
              key={item.key}
              icon={item.icon}
              label={item.label}
              onChange={(value) => void updateSettings({ [item.key]: value } as Partial<AppSettings>)}
              unit={item.unit}
              value={settings[item.key]}
            />
          ))}
        </div>

        <div className={styles.settingsGroup}>
          <h2>阶段切换</h2>
          <SettingSelect
            icon={SettingsUserIcon}
            label="完成专注后"
            onChange={(value) => void updateSettings({ autoStartBreaks: value === 'autoBreak' })}
            options={manualBreakOptions}
            value={settings.autoStartBreaks ? 'autoBreak' : 'manualBreak'}
          />
          <SettingSelect
            icon={SettingsRefreshIcon}
            label="完成短休 / 长休后"
            onChange={(value) => void updateSettings({ autoStartFocus: value === 'autoFocus' })}
            options={manualFocusOptions}
            value={settings.autoStartFocus ? 'autoFocus' : 'manualFocus'}
          />
        </div>

        <div className={styles.settingsGroup}>
          <h2>启动与窗口</h2>
          <SettingSwitch
            checked={settings.openAtLogin}
            icon={SettingsWindowIcon}
            label="开机自启"
            onChange={(value) => void updateSettings({ openAtLogin: value })}
          />
          <SettingSwitch
            checked={settings.startToTray}
            icon={SettingsWindowIcon}
            label="启动到托盘"
            onChange={(value) => void updateSettings({ startToTray: value })}
          />
        </div>

        <div className={styles.settingsGroup}>
          <h2>外观</h2>
          <SettingSelect
            icon={SettingsMoonIcon}
            label="主题模式"
            onChange={(value) => void updateSettings({ themePreference: value })}
            options={themeOptions}
            value={settings.themePreference}
          />
        </div>
      </div>
    </section>
  </div>
)
