import type { CSSProperties, ReactElement } from 'react'
import type { FocusStats } from '@shared/types'
import {
  StatsSummaryClipboardIcon,
  StatsSummaryClockIcon,
  StatsSummaryCupIcon,
  StatsSummaryRocketIcon
} from '../components/AppIcons'
import { formatDurationLabel } from '../viewModel'
import styles from '../App.module.css'

interface StatsViewProps {
  stats: FocusStats
}

export const getHourBarHeight = (minutes: number, maxHourly: number): string => {
  if (minutes <= 0) return '0%'
  return `${(minutes / maxHourly) * 100}%`
}

export const getRankBarWidth = (minutes: number, maxMinutes: number): string => {
  if (minutes <= 0) return '0%'
  return `${(minutes / maxMinutes) * 100}%`
}

interface FocusDurationRow {
  taskId: string
  title: string
  minutes: number
  kind: 'task' | 'unbound'
}

export const StatsView = ({ stats }: StatsViewProps): ReactElement => {
  const hourlyPeak = Math.max(...stats.hourlyFocusMinutes, 0)
  const maxHourly = Math.max(hourlyPeak, 1)
  const focusTotal = Math.max(stats.today.focusMinutes, 0)
  const shortBreakMinutes = Math.max(stats.today.shortBreakMinutes, 0)
  const longBreakMinutes = Math.max(stats.today.longBreakMinutes, 0)
  const unboundFocusMinutes = Math.max(stats.unboundFocusMinutes, 0)
  const breakTotal = shortBreakMinutes + longBreakMinutes
  const totalTrackedRaw = focusTotal + breakTotal
  const totalTracked = Math.max(totalTrackedRaw, 1)
  const focusPercent = Math.round((focusTotal / totalTracked) * 100)
  const breakPercent = Math.round(((focusTotal + shortBreakMinutes) / totalTracked) * 100)
  const completedTaskDurations: FocusDurationRow[] = [...stats.taskFocusMinutes]
    .sort((left, right) => right.minutes - left.minutes)
    .map((item) => ({
      taskId: item.taskId,
      title: item.title,
      minutes: item.minutes,
      kind: 'task'
    }))
  const focusDurationRows: FocusDurationRow[] = [
    ...completedTaskDurations,
    ...(unboundFocusMinutes > 0
      ? [
          {
            taskId: 'unbound-focus',
            title: '未绑定专注',
            minutes: unboundFocusMinutes,
            kind: 'unbound' as const
          }
        ]
      : [])
  ].sort((left, right) => right.minutes - left.minutes)
  const maxCompletedTaskMinutes = Math.max(...focusDurationRows.map((item) => item.minutes), 1)
  const halfHourlyPeak = Math.round(hourlyPeak / 2)
  const yAxisTicks = [hourlyPeak > 0 ? `${hourlyPeak}m` : '0m', `${halfHourlyPeak}m`, '0']
  const summaryCards = [
    {
      label: '专注时长',
      value: formatDurationLabel(focusTotal),
      meta: '今日累计',
      icon: StatsSummaryClockIcon,
      iconKey: 'focus'
    },
    {
      label: '完成番茄',
      value: `${stats.today.completedPomodoros}`,
      meta: '已完成',
      icon: StatsSummaryRocketIcon,
      iconKey: 'pomodoros'
    },
    {
      label: '任务完成数',
      value: `${stats.today.completedTasks}`,
      meta: '今日完成',
      icon: StatsSummaryClipboardIcon,
      iconKey: 'tasks'
    },
    {
      label: '休息时长',
      value: formatDurationLabel(breakTotal),
      meta: '短休 + 长休',
      icon: StatsSummaryCupIcon,
      iconKey: 'breaks'
    }
  ]

  return (
    <div className={styles.statsView}>
      <div className={styles.pageTopper}>
        <div aria-label="统计时间范围" className={styles.tabLine}>
          <strong>今天</strong>
          <span>日历</span>
          <span>周视图</span>
        </div>
      </div>

      <div className={styles.statsLayout}>
        <aside className={styles.statsNumbers}>
          {summaryCards.map((card) => {
            const Icon = card.icon
            return (
              <div className={styles.statsSummaryCard} data-summary-surface="white-card" key={card.label}>
                <div className={styles.statsSummaryContent}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.meta}</small>
                </div>
                <div className={styles.statsSummaryIcon} data-summary-icon={card.iconKey}>
                  <Icon className={styles.statsSummaryIconSvg} />
                </div>
              </div>
            )
          })}
        </aside>

        <section className={styles.chartPanel}>
          <div className={styles.statsPanelHeader}>
            <h2>今日专注时长分布</h2>
            <span>{hourlyPeak > 0 ? `峰值 ${hourlyPeak}m` : '暂无专注'}</span>
          </div>
          <div className={styles.hourChartFrame}>
            <div className={styles.yAxisTicks} aria-label="今日专注分布刻度">
              {yAxisTicks.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
            <div className={styles.hourChart}>
              {stats.hourlyFocusMinutes.map((minutes, hour) => (
                <div aria-label={`${hour}:00 ${minutes}m`} className={styles.hourSlot} key={hour}>
                  <div style={{ height: getHourBarHeight(minutes, maxHourly) }} />
                </div>
              ))}
            </div>
          </div>
          <div className={styles.chartAxisRow}>
            <span aria-hidden="true" />
            <div className={styles.chartAxis}>
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </div>
        </section>

        <section className={styles.compositionPanel}>
          <div className={styles.statsPanelHeader}>
            <h2>时间构成</h2>
            <span>{totalTrackedRaw > 0 ? `${totalTrackedRaw}m` : '无记录'}</span>
          </div>
          <div className={styles.compositionBody}>
            <div
              className={styles.donut}
              style={{ '--focus': `${focusPercent}%`, '--break': `${breakPercent}%` } as CSSProperties}
            />
            <div className={styles.legendList}>
              <span>
                <b />
                <em>专注</em>
                <strong>{focusTotal}m</strong>
              </span>
              <span>
                <b />
                <em>短休息</em>
                <strong>{shortBreakMinutes}m</strong>
              </span>
              <span>
                <b />
                <em>长休息</em>
                <strong>{longBreakMinutes}m</strong>
              </span>
            </div>
          </div>
        </section>

        <section className={styles.rankPanel}>
          <div className={styles.statsPanelHeader}>
            <h2>专注时长</h2>
            <span>今日已完成任务 + 未绑定专注</span>
          </div>
          {focusDurationRows.length === 0 ? (
            <div className={styles.statsEmptyState}>今天还没有专注时长记录</div>
          ) : (
            <div className={styles.rankList}>
              {focusDurationRows.map((item) => (
                <div className={styles.rankRow} data-rank-kind={item.kind} key={item.taskId}>
                  <div className={styles.rankRowTop}>
                    <span>{item.title}</span>
                    <strong>{item.minutes}m</strong>
                  </div>
                  <div className={styles.rankTrack}>
                    <span style={{ width: getRankBarWidth(item.minutes, maxCompletedTaskMinutes) }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
