import { useMemo, useState, type DragEvent, type KeyboardEvent, type ReactElement } from 'react'
import type { TaskBoardSnapshot } from '@shared/types'
import styles from '../App.module.css'
import { getTaskRowsForTab, reorderTaskIds, type TaskRowModel, type TaskViewTab } from '../viewModel'

interface TasksViewProps {
  completeTask(id: string): Promise<void>
  createTask(): Promise<void>
  deleteTask(id: string): Promise<void>
  newTaskTitle: string
  reorderTasks(ids: string[]): Promise<void>
  restoreTask(id: string): Promise<void>
  selectedTaskId: string | null
  selectedTaskTitle: string | null
  setNewTaskTitle(value: string): void
  setSelectedTaskId(value: string | null): void
  taskBoard: TaskBoardSnapshot
  updateTask(id: string, title: string): Promise<void>
}

const tabLabel: Record<TaskViewTab, string> = {
  all: '全部',
  active: '进行中',
  completed: '已完成'
}

const emptyStateByTab: Record<TaskViewTab, string> = {
  all: '还没有任务，先创建一个开始吧。',
  active: '当前没有进行中的任务。',
  completed: '还没有已完成的任务。'
}

export const TasksView = ({
  completeTask,
  createTask,
  deleteTask,
  newTaskTitle,
  reorderTasks,
  restoreTask,
  selectedTaskId,
  selectedTaskTitle,
  setNewTaskTitle,
  setSelectedTaskId,
  taskBoard,
  updateTask
}: TasksViewProps): ReactElement => {
  const [activeTab, setActiveTab] = useState<TaskViewTab>('active')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [dragSourceTaskId, setDragSourceTaskId] = useState<string | null>(null)
  const [dragTargetTaskId, setDragTargetTaskId] = useState<string | null>(null)

  const rows = useMemo(
    () => getTaskRowsForTab(taskBoard, activeTab, selectedTaskId),
    [activeTab, selectedTaskId, taskBoard]
  )
  const rowById = useMemo(
    () => new Map(getTaskRowsForTab(taskBoard, 'all', selectedTaskId).map((row) => [row.id, row])),
    [selectedTaskId, taskBoard]
  )
  const canDragActiveRows = activeTab === 'active' && taskBoard.activeItems.length > 1

  const stopEditing = (): void => {
    setEditingTaskId(null)
    setDraftTitle('')
  }

  const startEditing = (row: TaskRowModel): void => {
    setEditingTaskId(row.id)
    setDraftTitle(row.title)
  }

  const saveEditing = (rowId: string): void => {
    const row = rowById.get(rowId)
    const trimmed = draftTitle.trim()
    stopEditing()
    if (!row || !trimmed || trimmed === row.title) return
    void updateTask(rowId, trimmed)
  }

  const handleDragStart = (event: DragEvent<HTMLDivElement>, taskId: string): void => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', taskId)
    setDragSourceTaskId(taskId)
  }

  const handleDrop = (targetTaskId: string): void => {
    if (!dragSourceTaskId || dragSourceTaskId === targetTaskId) {
      setDragSourceTaskId(null)
      setDragTargetTaskId(null)
      return
    }

    const nextIds = reorderTaskIds(
      taskBoard.activeItems.map((item) => item.id),
      dragSourceTaskId,
      targetTaskId
    )
    setDragSourceTaskId(null)
    setDragTargetTaskId(null)
    void reorderTasks(nextIds)
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>, rowId: string): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveEditing(rowId)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      stopEditing()
    }
  }

  return (
    <div className={styles.listView}>
      <div className={styles.pageTopper}>
        <div className={styles.taskTabs}>
          {(['all', 'active', 'completed'] as TaskViewTab[]).map((tab) => (
            <button
              className={`${styles.taskTabButton} ${activeTab === tab ? styles.taskTabActive : ''}`}
              key={tab}
              onClick={() => {
                stopEditing()
                setDragSourceTaskId(null)
                setDragTargetTaskId(null)
                setActiveTab(tab)
              }}
              type="button"
            >
              {tabLabel[tab]} {taskBoard.counts[tab === 'all' ? 'all' : tab]}
            </button>
          ))}
        </div>
        <form
          className={styles.inlineTaskForm}
          onSubmit={(event) => {
            event.preventDefault()
            void createTask()
          }}
        >
          <input
            onChange={(event) => setNewTaskTitle(event.target.value)}
            placeholder="新增任务"
            value={newTaskTitle}
          />
          <button type="submit">+ 新增任务</button>
        </form>
      </div>

      <div className={styles.taskListHeader}>
        <span>状态</span>
        <span>任务</span>
        <span>统计</span>
        <span />
      </div>

      <div className={styles.denseList}>
        {rows.length === 0 ? (
          <div className={styles.taskEmptyState}>{emptyStateByTab[activeTab]}</div>
        ) : (
          rows.map((row) => {
            const isEditing = editingTaskId === row.id
            const isDragEnabled = canDragActiveRows && !row.isCompleted && !isEditing

            return (
              <div
                className={`${styles.taskLine} ${row.isSelected ? styles.taskLineSelected : ''} ${
                  row.isCompleted ? styles.taskLineDone : ''
                } ${isDragEnabled ? styles.taskDraggable : ''} ${
                  dragTargetTaskId === row.id ? styles.taskDropTarget : ''
                }`}
                draggable={isDragEnabled}
                key={row.id}
                onClick={() => {
                  if (!row.isCompleted) {
                    setSelectedTaskId(row.id)
                  }
                }}
                onDragEnd={() => {
                  setDragSourceTaskId(null)
                  setDragTargetTaskId(null)
                }}
                onDragOver={(event) => {
                  if (!canDragActiveRows || !dragSourceTaskId || row.isCompleted) return
                  event.preventDefault()
                  setDragTargetTaskId(row.id)
                }}
                onDragStart={(event) => handleDragStart(event, row.id)}
                onDrop={(event) => {
                  if (!canDragActiveRows || row.isCompleted) return
                  event.preventDefault()
                  handleDrop(row.id)
                }}
              >
                <button
                  className={`${styles.taskStateButton} ${row.isCompleted ? styles.taskRestoreButton : styles.checkButton}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (row.isCompleted) {
                      void restoreTask(row.id)
                      return
                    }
                    void completeTask(row.id)
                  }}
                  type="button"
                >
                  {row.isCompleted ? '↺' : ''}
                </button>

                {isEditing ? (
                  <input
                    autoFocus
                    className={styles.taskTitleInput}
                    onBlur={() => saveEditing(row.id)}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => handleEditKeyDown(event, row.id)}
                    value={draftTitle}
                  />
                ) : (
                  <button
                    className={styles.taskNameButton}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (!row.isCompleted) {
                        setSelectedTaskId(row.id)
                      }
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      startEditing(row)
                    }}
                    type="button"
                  >
                    {row.title}
                  </button>
                )}

                <div className={styles.taskStats}>
                  <span className={styles.taskStatusDot}>{row.statusLabel}</span>
                  <span className={styles.tomatoBadge}>{row.completedPomodoros} 个番茄钟</span>
                  <span className={styles.taskFocusBadge}>{row.focusMinutes}m</span>
                </div>

                <button
                  className={`${styles.taskGhostAction} ${styles.taskDeleteButton}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void deleteTask(row.id)
                  }}
                  type="button"
                >
                  ×
                </button>
              </div>
            )
          })
        )}
      </div>

      {canDragActiveRows ? <p className={styles.dragHint}>拖拽任务可调整顺序</p> : null}
      <p className={styles.selectedHint}>当前绑定任务：{selectedTaskTitle ?? '未选择'}</p>
    </div>
  )
}
