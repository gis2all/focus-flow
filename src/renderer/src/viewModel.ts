import type { TaskBoardItem, TaskBoardSnapshot, ThemePreference } from '@shared/types'

export type TaskViewTab = 'all' | 'active' | 'completed'

export interface TaskRowModel {
  id: string
  title: string
  isCompleted: boolean
  isSelected: boolean
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

export const resolveEffectiveTheme = (
  preference: ThemePreference,
  systemTheme: 'light' | 'dark'
): 'light' | 'dark' => (preference === 'system' ? systemTheme : preference)

export const buildTaskRows = (items: TaskBoardItem[], selectedTaskId: string | null): TaskRowModel[] =>
  items.map((item) => {
    const isCompleted = Boolean(item.completedAt)
    return {
      id: item.id,
      title: item.title,
      isCompleted,
      isSelected: !isCompleted && item.id === selectedTaskId,
      statusLabel: isCompleted ? '已完成' : '进行中',
      completedPomodoros: item.completedPomodoros,
      focusMinutes: item.focusMinutes
    }
  })

export const getTaskRowsForTab = (
  board: TaskBoardSnapshot,
  tab: TaskViewTab,
  selectedTaskId: string | null
): TaskRowModel[] => {
  const activeRows = buildTaskRows(board.activeItems, selectedTaskId)
  const completedRows = buildTaskRows(board.completedItems, null)

  if (tab === 'active') return activeRows
  if (tab === 'completed') return completedRows
  return [...activeRows, ...completedRows]
}

export const resolveSelectedTaskId = (
  board: TaskBoardSnapshot,
  preferredTaskId: string | null
): string | null => {
  if (preferredTaskId && board.activeItems.some((item) => item.id === preferredTaskId)) {
    return preferredTaskId
  }
  return board.activeItems[0]?.id ?? null
}

export const buildTaskTitleById = (board: TaskBoardSnapshot): Record<string, string> =>
  Object.fromEntries([...board.activeItems, ...board.completedItems].map((item) => [item.id, item.title]))

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
