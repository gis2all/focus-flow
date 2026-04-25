import type { CSSProperties, ReactElement } from 'react'
import type { FocusStats } from '@shared/types'
import { formatDurationLabel } from '../viewModel'
import styles from '../App.module.css'

interface StatsViewProps {
  stats: FocusStats
  taskTitleById: Record<string, string>
}

export const getHourBarHeight = (minutes: number, maxHourly: number): string => {
  if (minutes <= 0) return '0%'
  return `${(minutes / maxHourly) * 100}%`
}

export const StatsView = ({ stats, taskTitleById }: StatsViewProps): ReactElement => {
  const maxHourly = Math.max(...stats.hourlyFocusMinutes, 1)
  const focusTotal = Math.max(stats.today.focusMinutes, 0)
  const shortBreakMinutes = Math.max(stats.today.shortBreakMinutes, 0)
  const longBreakMinutes = Math.max(stats.today.longBreakMinutes, 0)
  const totalTracked = Math.max(focusTotal + shortBreakMinutes + longBreakMinutes, 1)
  const focusPercent = Math.round((focusTotal / totalTracked) * 100)
  const breakPercent = Math.round(((focusTotal + shortBreakMinutes) / totalTracked) * 100)

  return (
    <div className={styles.statsView}>
      <div className={styles.pageTopper}>
        <div className={styles.tabLine}>
          <strong>今天</strong>
          <span>日历</span>
          <span>周视图</span>
        </div>
      </div>

      <div className={styles.statsLayout}>
        <aside className={styles.statsNumbers}>
          <div className={styles.metricCard}>
            <span>专注时长</span>
            <strong>{formatDurationLabel(stats.today.focusMinutes)}</strong>
          </div>
          <div>
            <span>完成番茄钟</span>
            <strong>{stats.today.completedPomodoros}</strong>
          </div>
          <div>
            <span>任务完成数</span>
            <strong>{stats.today.completedTasks}</strong>
          </div>
          <div>
            <span>专注次数</span>
            <strong>{stats.today.completedPomodoros}</strong>
          </div>
        </aside>

        <section className={styles.chartPanel}>
          <h2>今日专注时长分布</h2>
          <div className={styles.hourChart}>
            {stats.hourlyFocusMinutes.map((minutes, hour) => (
              <div className={styles.hourSlot} key={hour}>
                <div style={{ height: getHourBarHeight(minutes, maxHourly) }} />
              </div>
            ))}
          </div>
          <div className={styles.chartAxis}>
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </section>

        <section className={styles.donutPanel}>
          <div
            className={styles.donut}
            style={{ '--focus': `${focusPercent}%`, '--break': `${breakPercent}%` } as CSSProperties}
          />
          <div className={styles.legendList}>
            <span>
              <b />专注 {stats.today.focusMinutes}m
            </span>
            <span>
              <b />短休息 {shortBreakMinutes}m
            </span>
            <span>
              <b />长休息 {longBreakMinutes}m
            </span>
          </div>
        </section>

        <section className={styles.rankPanel}>
          <h2>专注时长（按任务）</h2>
          {stats.taskFocusMinutes.length === 0 ? (
            <div className={styles.statsEmptyState}>暂无专注记录</div>
          ) : (
            stats.taskFocusMinutes.slice(0, 5).map((item) => (
              <div key={item.taskId}>
                <span>{taskTitleById[item.taskId] ?? '已删除任务'}</span>
                <strong>{item.minutes}m</strong>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
