import type { TaskBoardItem, TaskBoardSnapshot, ThemePreference, TimerSnapshot } from '@shared/types'

export type TaskViewTab = 'all' | 'active' | 'completed'

export interface TaskRowModel {
  id: string
  title: string
  isCompleted: boolean
  statusLabel: '进行中' | '已完成'
  completedPomodoros: number
  focusMinutes: number
}

export const formatTimerClock = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const formatDurationLabel = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours}h ${rest}m`
}

export const clampProgress = (value: number): number => Math.min(1, Math.max(0, value))

export const getSmoothedTimerProgress = (
  snapshot: Pick<TimerSnapshot, 'status' | 'startedAt' | 'targetEndAt' | 'durationMs' | 'progress'>,
  now: number
): number => {
  if (snapshot.status !== 'running' || snapshot.targetEndAt === null || snapshot.durationMs <= 0) {
    return clampProgress(snapshot.progress)
  }

  const remainingMs = Math.max(0, snapshot.targetEndAt - now)
  const elapsedMs = Math.min(snapshot.durationMs, Math.max(0, snapshot.durationMs - remainingMs))
  return clampProgress(elapsedMs / snapshot.durationMs)
}

export const resolveEffectiveTheme = (
  preference: ThemePreference,
  systemTheme: 'light' | 'dark'
): 'light' | 'dark' => (preference === 'system' ? systemTheme : preference)

export const buildTaskRows = (items: TaskBoardItem[]): TaskRowModel[] =>
  items.map((item) => {
    const isCompleted = Boolean(item.completedAt)
    return {
      id: item.id,
      title: item.title,
      isCompleted,
      statusLabel: isCompleted ? '已完成' : '进行中',
      completedPomodoros: item.completedPomodoros,
      focusMinutes: item.focusMinutes
    }
  })

export const getTaskRowsForTab = (board: TaskBoardSnapshot, tab: TaskViewTab): TaskRowModel[] => {
  const activeRows = buildTaskRows(board.activeItems)
  const completedRows = buildTaskRows(board.completedItems)

  if (tab === 'active') return activeRows
  if (tab === 'completed') return completedRows
  return [...activeRows, ...completedRows]
}

export const buildTaskTitleById = (board: TaskBoardSnapshot): Record<string, string> =>
  Object.fromEntries([...board.activeItems, ...board.completedItems].map((item) => [item.id, item.title]))

export const resolveCurrentTaskTitle = (
  snapshot: Pick<TimerSnapshot, 'taskId' | 'phase' | 'status'>,
  taskTitleById: Record<string, string>
): string => {
  if (snapshot.taskId) {
    return taskTitleById[snapshot.taskId] ?? '已删除任务'
  }

  if (snapshot.phase === 'focus' && snapshot.status === 'idle') {
    return '当前尚未开始专注'
  }

  return '当前阶段未绑定任务'
}

export const reorderTaskIds = (ids: string[], sourceId: string, targetId: string): string[] => {
  if (sourceId === targetId) return [...ids]

  const sourceIndex = ids.indexOf(sourceId)
  const targetIndex = ids.indexOf(targetId)
  if (sourceIndex === -1 || targetIndex === -1) return [...ids]

  const nextIds = [...ids]
  const [movedId] = nextIds.splice(sourceIndex, 1)
  nextIds.splice(targetIndex, 0, movedId)
  return nextIds
}
