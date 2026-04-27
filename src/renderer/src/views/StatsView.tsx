import type { CSSProperties, ReactElement } from 'react'
import type { CalendarDayStats, FocusStats, MonthStats } from '@shared/types'
import {
  StatsSummaryClipboardIcon,
  StatsSummaryClockIcon,
  StatsSummaryCupIcon,
  StatsSummaryRocketIcon
} from '../components/AppIcons'
import { formatDurationLabel } from '../viewModel'
import styles from '../App.module.css'

export type StatsTab = 'today' | 'calendar'
export type CalendarMonthDirection = 'previous' | 'next'

interface StatsViewProps {
  activeStatsTab: StatsTab
  canGoToNextMonth: boolean
  monthStats: MonthStats
  onCalendarMonthChange(direction: CalendarMonthDirection): void
  onStatsTabChange(tab: StatsTab): void
  stats: FocusStats
}

interface CalendarGridItem {
  key: string
  day: CalendarDayStats | null
}

interface FocusDurationRow {
  taskId: string
  title: string
  minutes: number
  kind: 'task' | 'unbound'
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const localDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getCalendarGridItems = (monthStats: MonthStats): CalendarGridItem[] => {
  const leadingBlankCount = (new Date(monthStats.year, monthStats.month - 1, 1).getDay() + 6) % 7
  const totalCells = Math.ceil((leadingBlankCount + monthStats.days.length) / 7) * 7
  const trailingBlankCount = totalCells - leadingBlankCount - monthStats.days.length
  const leading = Array.from({ length: leadingBlankCount }, (_, index) => ({
    key: `leading-${index}`,
    day: null
  }))
  const days = monthStats.days.map((day) => ({
    key: day.date,
    day
  }))
  const trailing = Array.from({ length: trailingBlankCount }, (_, index) => ({
    key: `trailing-${index}`,
    day: null
  }))

  return [...leading, ...days, ...trailing]
}

const formatCalendarDateLabel = (date: string): string => {
  const [, month, day] = date.split('-')
  return `${Number(month)}月${Number(day)}日`
}

export const getHourBarHeight = (minutes: number, maxHourly: number): string => {
  if (minutes <= 0) return '0%'
  return `${(minutes / maxHourly) * 100}%`
}

export const getRankBarWidth = (minutes: number, maxMinutes: number): string => {
  if (minutes <= 0) return '0%'
  return `${(minutes / maxMinutes) * 100}%`
}

export const getCalendarHeatLevel = (day: CalendarDayStats, maxFocusMinutes: number): number => {
  if (day.isFuture || day.focusMinutes <= 0 || maxFocusMinutes <= 0) return 0
  const ratio = day.focusMinutes / maxFocusMinutes
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

const getCalendarDayAriaLabel = (day: CalendarDayStats, isToday: boolean): string => {
  const breakMinutes = day.shortBreakMinutes + day.longBreakMinutes
  const todayLabel = isToday ? '，今天' : ''
  return `${formatCalendarDateLabel(day.date)}${todayLabel}，专注 ${formatDurationLabel(
    day.focusMinutes
  )}，完成番茄 ${day.completedPomodoros}，完成任务 ${day.completedTasks}，休息 ${formatDurationLabel(
    breakMinutes
  )}`
}

export const StatsView = ({
  activeStatsTab,
  canGoToNextMonth,
  monthStats,
  onCalendarMonthChange,
  onStatsTabChange,
  stats
}: StatsViewProps): ReactElement => {
  const isCalendarTab = activeStatsTab === 'calendar'
  const summary = isCalendarTab ? monthStats.summary : stats.today
  const summaryBreakTotal = summary.shortBreakMinutes + summary.longBreakMinutes
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
      value: formatDurationLabel(summary.focusMinutes),
      meta: isCalendarTab ? '本月累计' : '今日累计',
      icon: StatsSummaryClockIcon,
      iconKey: 'focus'
    },
    {
      label: '完成番茄',
      value: `${summary.completedPomodoros}`,
      meta: '已完成',
      icon: StatsSummaryRocketIcon,
      iconKey: 'pomodoros'
    },
    {
      label: '任务完成数',
      value: `${summary.completedTasks}`,
      meta: isCalendarTab ? '本月完成' : '今日完成',
      icon: StatsSummaryClipboardIcon,
      iconKey: 'tasks'
    },
    {
      label: '休息时长',
      value: formatDurationLabel(summaryBreakTotal),
      meta: '短休 + 长休',
      icon: StatsSummaryCupIcon,
      iconKey: 'breaks'
    }
  ]
  const todayKey = localDateKey(new Date())
  const calendarGridItems = getCalendarGridItems(monthStats)

  return (
    <div className={styles.statsView}>
      <div className={styles.pageTopper}>
        <div aria-label="统计时间范围" className={styles.tabLine} role="tablist">
          <button
            aria-selected={activeStatsTab === 'today'}
            onClick={() => onStatsTabChange('today')}
            role="tab"
            type="button"
          >
            今天
          </button>
          <button
            aria-selected={activeStatsTab === 'calendar'}
            onClick={() => onStatsTabChange('calendar')}
            role="tab"
            type="button"
          >
            日历
          </button>
          <button aria-disabled="true" aria-selected="false" disabled role="tab" type="button">
            周视图
          </button>
        </div>
      </div>

      <div className={`${styles.statsLayout} ${isCalendarTab ? styles.calendarStatsLayout : ''}`}>
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

        {isCalendarTab ? (
          <section className={styles.calendarPanel}>
            <div className={styles.calendarPanelHeader}>
              <div>
                <h2>
                  {monthStats.year}年 {monthStats.month}月
                </h2>
              </div>
              <div className={styles.calendarMonthNav} aria-label="切换月份">
                <button onClick={() => onCalendarMonthChange('previous')} type="button">
                  上月
                </button>
                <button disabled={!canGoToNextMonth} onClick={() => onCalendarMonthChange('next')} type="button">
                  下月
                </button>
              </div>
            </div>

            <div className={styles.calendarWeekdays} aria-hidden="true">
              {WEEKDAY_LABELS.map((label, index) => (
                <span data-calendar-weekday={index} key={label}>
                  {label}
                </span>
              ))}
            </div>

            <div className={styles.calendarGrid} role="grid">
              {calendarGridItems.map((item) => {
                if (!item.day) {
                  return <span aria-hidden="true" data-calendar-placeholder="true" key={item.key} />
                }

                const day = item.day
                const isToday = day.date === todayKey
                const breakMinutes = day.shortBreakMinutes + day.longBreakMinutes
                const heatLevel = getCalendarHeatLevel(day, monthStats.maxFocusMinutes)

                return (
                  <button
                    aria-label={getCalendarDayAriaLabel(day, isToday)}
                    className={styles.calendarDay}
                    data-calendar-date={day.date}
                    data-calendar-future={day.isFuture ? 'true' : undefined}
                    data-calendar-today={isToday ? 'true' : undefined}
                    data-heat-level={heatLevel}
                    disabled={day.isFuture}
                    key={day.date}
                    role="gridcell"
                    type="button"
                  >
                    {isToday ? (
                      <span aria-hidden="true" className={styles.calendarTodayDot} data-calendar-today-dot="true" />
                    ) : null}
                    <span className={styles.calendarDayNumber}>{Number(day.date.slice(-2))}</span>
                    {isToday ? (
                      <em className={styles.calendarTodayLabel} data-calendar-today-label="true">
                        今天
                      </em>
                    ) : null}
                    {!day.isFuture ? (
                      <span className={styles.calendarTooltip} role="tooltip">
                        <strong>
                          {formatCalendarDateLabel(day.date)}
                          {isToday ? ' · 今天' : ''}
                        </strong>
                        <span>专注 {formatDurationLabel(day.focusMinutes)}</span>
                        <span>完成番茄 {day.completedPomodoros}</span>
                        <span>完成任务 {day.completedTasks}</span>
                        <span>休息 {formatDurationLabel(breakMinutes)}</span>
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div className={styles.calendarLegend} aria-label="专注时长强度">
              <span>少</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <i data-heat-level={level} key={level} />
              ))}
              <span>多</span>
            </div>
          </section>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
