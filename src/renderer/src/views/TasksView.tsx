import { useMemo, useState, type DragEvent, type KeyboardEvent, type ReactElement } from 'react'
import type { TaskBoardSnapshot } from '@shared/types'
import styles from '../App.module.css'
import { getTaskRowsForTab, reorderTaskIds, type TaskRowModel, type TaskViewTab } from '../viewModel'

interface TasksViewProps {
  bindCurrentTask(taskId: string | null): Promise<void>
  canBindCurrentTask: boolean
  completeTask(id: string): Promise<void>
  createTask(): Promise<void>
  currentTimerTaskId: string | null
  deleteTask(id: string): Promise<void>
  newTaskTitle: string
  reorderTasks(ids: string[]): Promise<void>
  restoreTask(id: string): Promise<void>
  setNewTaskTitle(value: string): void
  startFocusWithTask(taskId: string): Promise<void>
  taskBoard: TaskBoardSnapshot
  updateTask(id: string, title: string): Promise<void>
}

type ConfirmDialogState =
  | { kind: 'unbind'; taskTitle: string }
  | { kind: 'delete'; taskId: string; taskTitle: string }
  | null

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
  bindCurrentTask,
  canBindCurrentTask,
  completeTask,
  createTask,
  currentTimerTaskId,
  deleteTask,
  newTaskTitle,
  reorderTasks,
  restoreTask,
  setNewTaskTitle,
  startFocusWithTask,
  taskBoard,
  updateTask
}: TasksViewProps): ReactElement => {
  const [activeTab, setActiveTab] = useState<TaskViewTab>('active')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [dragSourceTaskId, setDragSourceTaskId] = useState<string | null>(null)
  const [dragTargetTaskId, setDragTargetTaskId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null)
  const [confirmPending, setConfirmPending] = useState(false)

  const rows = useMemo(() => getTaskRowsForTab(taskBoard, activeTab), [activeTab, taskBoard])
  const rowById = useMemo(() => new Map(getTaskRowsForTab(taskBoard, 'all').map((row) => [row.id, row])), [taskBoard])
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

  const handleConfirmAction = async (): Promise<void> => {
    if (!confirmDialog || confirmPending) return
    setConfirmPending(true)

    try {
      if (confirmDialog.kind === 'unbind') {
        await bindCurrentTask(null)
      } else {
        await deleteTask(confirmDialog.taskId)
      }
      setConfirmDialog(null)
    } finally {
      setConfirmPending(false)
    }
  }

  return (
    <div className={styles.listView}>
      <div className={styles.taskControls}>
        <div className={styles.pageTopper}>
          <div className={styles.pageTopperLeft}>
            <div aria-label="任务筛选" className={styles.taskTabs} role="tablist">
              {(['all', 'active', 'completed'] as TaskViewTab[]).map((tab) => (
                <button
                  aria-selected={activeTab === tab}
                  className={`${styles.taskTabButton} ${activeTab === tab ? styles.taskTabActive : ''}`}
                  key={tab}
                  onClick={() => {
                    stopEditing()
                    setDragSourceTaskId(null)
                    setDragTargetTaskId(null)
                    setActiveTab(tab)
                  }}
                  role="tab"
                  type="button"
                >
                  <span>{tabLabel[tab]}</span>
                  <b>{taskBoard.counts[tab === 'all' ? 'all' : tab]}</b>
                </button>
              ))}
            </div>
          </div>
          <form
            aria-label="新增任务"
            className={styles.inlineTaskForm}
            onSubmit={(event) => {
              event.preventDefault()
              void createTask()
            }}
          >
            <input
              aria-label="任务标题"
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="新任务"
              value={newTaskTitle}
            />
            <button type="submit">新增任务</button>
          </form>
        </div>
      </div>

      <div className={styles.taskListShell}>
        <div className={styles.taskListHeader}>
          <span>完成</span>
          <span>任务</span>
          <span>统计</span>
          <span>绑定</span>
          <span>操作</span>
        </div>

        <div aria-label="任务列表" className={styles.denseList} role="list">
          {rows.length === 0 ? (
            <div className={styles.taskEmptyState}>{emptyStateByTab[activeTab]}</div>
          ) : (
            rows.map((row) => {
              const isEditing = editingTaskId === row.id
              const isDragEnabled = canDragActiveRows && !row.isCompleted && !isEditing
              const isBoundToCurrentTimer = canBindCurrentTask && !row.isCompleted && row.id === currentTimerTaskId

              return (
                <div
                  className={`${styles.taskLine} ${row.isCompleted ? styles.taskLineDone : ''} ${
                    isDragEnabled ? styles.taskDraggable : ''
                  } ${dragTargetTaskId === row.id ? styles.taskDropTarget : ''} ${
                    isBoundToCurrentTimer ? styles.taskLineCurrent : ''
                  }`}
                  data-current-task={isBoundToCurrentTimer ? 'true' : 'false'}
                  data-task-surface="floating-card"
                  draggable={isDragEnabled}
                  key={row.id}
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
                  role="listitem"
                >
                  <button
                    aria-label={row.isCompleted ? `恢复任务 ${row.title}` : `完成任务 ${row.title}`}
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
                    {row.isCompleted ? '↩' : ''}
                  </button>

                  <div className={styles.taskMain}>
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
                    <span
                      className={`${styles.taskStatusBadge} ${
                        row.isCompleted ? styles.taskStatusBadgeDone : styles.taskStatusBadgeActive
                      }`}
                    >
                      {row.statusLabel}
                    </span>
                  </div>

                  <div className={styles.taskStats}>
                    <span className={styles.taskStatPill}>{row.completedPomodoros} 个番茄钟</span>
                    <span className={`${styles.taskStatPill} ${styles.taskStatPillMuted}`}>{row.focusMinutes}m</span>
                  </div>

                  <div className={styles.taskBindCell}>
                    {!row.isCompleted ? (
                      <button
                        aria-label={isBoundToCurrentTimer ? `当前已绑定任务 ${row.title}` : `绑定任务 ${row.title}`}
                        aria-pressed={isBoundToCurrentTimer}
                        className={`${styles.taskBindButton} ${isBoundToCurrentTimer ? styles.taskBindButtonActive : ''}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (isBoundToCurrentTimer) {
                            setConfirmDialog({ kind: 'unbind', taskTitle: row.title })
                            return
                          }
                          if (!canBindCurrentTask) {
                            void startFocusWithTask(row.id)
                            return
                          }
                          void bindCurrentTask(row.id)
                        }}
                        title={
                          canBindCurrentTask
                            ? isBoundToCurrentTimer
                              ? `点击解绑任务「${row.title}」`
                              : `绑定当前专注到任务「${row.title}」`
                            : `启动专注并绑定到任务「${row.title}」`
                        }
                        type="button"
                      >
                        {isBoundToCurrentTimer ? '已绑定' : canBindCurrentTask ? '绑定' : '设为当前'}
                      </button>
                    ) : null}
                  </div>

                  <div className={styles.taskDangerCell}>
                    <button
                      aria-label={`删除任务 ${row.title}`}
                      className={styles.taskDangerButton}
                      onClick={(event) => {
                        event.stopPropagation()
                        setConfirmDialog({ kind: 'delete', taskId: row.id, taskTitle: row.title })
                      }}
                      title={`删除任务「${row.title}」`}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {confirmDialog ? (
        <div className={styles.modalOverlay} onClick={() => !confirmPending && setConfirmDialog(null)} role="presentation">
          <section
            aria-label="确认对话框"
            className={styles.confirmModal}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.confirmModalHeader}>
              <strong>FocusFlow</strong>
              <span>{confirmDialog.kind === 'unbind' ? '解绑确认' : '删除确认'}</span>
            </header>
            <p className={styles.confirmModalTitle}>
              {confirmDialog.kind === 'unbind'
                ? `确认解绑任务「${confirmDialog.taskTitle}」吗？`
                : `确认删除任务「${confirmDialog.taskTitle}」吗？`}
            </p>
            <p className={styles.confirmModalBody}>
              {confirmDialog.kind === 'unbind'
                ? '解绑后当前专注将不再关联该任务。'
                : '删除后任务会从列表移除，历史专注统计会按“已删除任务”展示。'}
            </p>
            <div className={styles.confirmModalActions}>
              <button
                className={styles.confirmModalCancel}
                disabled={confirmPending}
                onClick={() => setConfirmDialog(null)}
                type="button"
              >
                取消
              </button>
              <button
                className={
                  confirmDialog.kind === 'unbind' ? styles.confirmModalPrimary : styles.confirmModalDanger
                }
                disabled={confirmPending}
                onClick={() => void handleConfirmAction()}
                type="button"
              >
                {confirmDialog.kind === 'unbind' ? '确认解绑' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
