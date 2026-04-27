import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactElement } from 'react'
import type { TaskBoardSnapshot, TimerSnapshot } from '@shared/types'
import styles from '../App.module.css'
import { ConfirmModal } from '../components/ConfirmModal'
import { getTimerActionConfirmation, shouldConfirmTimerAction } from '../timerActionConfirmation'
import { getTaskRowsForTab, reorderTaskIds, type TaskRowModel, type TaskViewTab } from '../viewModel'

interface TasksViewProps {
  activeTab: TaskViewTab
  bindCurrentTask(taskId: string | null): Promise<void>
  canBindCurrentTask: boolean
  completeTask(id: string): Promise<void>
  createTask(): Promise<void>
  currentTimerTaskId: string | null
  deleteTask(id: string): Promise<void>
  newTaskTitle: string
  onActiveTabChange(tab: TaskViewTab): void
  reorderTasks(ids: string[]): Promise<void>
  restoreTask(id: string): Promise<void>
  setNewTaskTitle(value: string): void
  startFocusWithTask(taskId: string): Promise<void>
  taskBoard: TaskBoardSnapshot
  timerContext: Pick<TimerSnapshot, 'status' | 'phase'>
  updateTask(id: string, title: string): Promise<void>
}

type ConfirmDialogState =
  | { kind: 'unbind'; taskTitle: string }
  | { kind: 'rebind'; previousTaskTitle: string; taskId: string; taskTitle: string }
  | { kind: 'delete'; taskId: string; taskTitle: string }
  | { kind: 'startFocusWithTask'; taskId: string; taskTitle: string }
  | null

type TaskBindAction =
  | { kind: 'unbind' }
  | { kind: 'rebind' }
  | { kind: 'bind' }
  | { kind: 'startFocusWithTask' }
  | { kind: 'confirmRebind' }
  | { kind: 'confirmStartFocusWithTask' }

interface ResolveTaskBindActionInput {
  canBindCurrentTask: boolean
  currentTimerTaskId: string | null
  rowId: string
  timerContext: Pick<TimerSnapshot, 'status' | 'phase'>
}

export const resolveTaskBindAction = ({
  canBindCurrentTask,
  currentTimerTaskId,
  rowId,
  timerContext
}: ResolveTaskBindActionInput): TaskBindAction => {
  if (canBindCurrentTask) {
    if (currentTimerTaskId === rowId) {
      return { kind: 'unbind' }
    }

    if (currentTimerTaskId !== null) {
      return { kind: 'confirmRebind' }
    }

    return { kind: 'bind' }
  }

  if (shouldConfirmTimerAction(timerContext)) {
    return { kind: 'confirmStartFocusWithTask' }
  }

  return { kind: 'startFocusWithTask' }
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

const taskTabOrder: TaskViewTab[] = ['active', 'completed', 'all']

type OverflowMetrics = Pick<HTMLElement, 'clientWidth' | 'scrollWidth'>

export const isTaskTitleOverflowing = (metrics: OverflowMetrics | null): boolean =>
  metrics !== null && metrics.scrollWidth > metrics.clientWidth

type TooltipAnchorRect = Pick<DOMRect, 'left' | 'top'>

interface TaskTitleTooltipLayout {
  left: number
  maxWidth: number
  top: number
}

export const getTaskTitleTooltipLayout = (
  anchorRect: TooltipAnchorRect | null,
  viewportWidth: number
): TaskTitleTooltipLayout | null => {
  if (!anchorRect) return null

  const sidePadding = 12
  const gap = 8
  const maxWidth = Math.min(420, Math.max(0, viewportWidth - sidePadding * 2))
  const maxLeft = Math.max(sidePadding, viewportWidth - maxWidth - sidePadding)

  return {
    top: anchorRect.top - gap,
    left: Math.min(Math.max(anchorRect.left, sidePadding), maxLeft),
    maxWidth
  }
}

interface TaskTitleTooltipState {
  color: string | null
  left: number
  maxWidth: number
  text: string
  top: number
}

interface TaskTitleButtonProps {
  onHideTooltip(): void
  onShowTooltip(payload: { anchorRect: TooltipAnchorRect; color: string | null; text: string }): void
  onStartEditing(): void
  title: string
}

const TaskTitleButton = ({ onHideTooltip, onShowTooltip, onStartEditing, title }: TaskTitleButtonProps): ReactElement => {
  const titleRef = useRef<HTMLSpanElement | null>(null)

  const hasOverflowingTitle = (): boolean => isTaskTitleOverflowing(titleRef.current)

  useEffect(() => {
    const updateTooltipVisibility = (): void => {
      if (!hasOverflowingTitle()) {
        onHideTooltip()
      }
    }

    updateTooltipVisibility()

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            updateTooltipVisibility()
          })
        : null

    if (titleRef.current && resizeObserver) {
      resizeObserver.observe(titleRef.current)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateTooltipVisibility)
    }

    return () => {
      resizeObserver?.disconnect()
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateTooltipVisibility)
      }
      onHideTooltip()
    }
  }, [onHideTooltip, title])

  return (
    <div className={styles.taskMain}>
      <button
        className={styles.taskNameButton}
        onClick={(event) => {
          event.stopPropagation()
        }}
        onFocus={() => {
          if (!hasOverflowingTitle() || !titleRef.current) return
          onShowTooltip({
            anchorRect: titleRef.current.getBoundingClientRect(),
            color: typeof window === 'undefined' ? null : window.getComputedStyle(titleRef.current).color,
            text: title
          })
        }}
        onBlur={() => {
          onHideTooltip()
        }}
        onDoubleClick={(event) => {
          event.stopPropagation()
          onHideTooltip()
          onStartEditing()
        }}
        onMouseEnter={() => {
          if (!hasOverflowingTitle() || !titleRef.current) return
          onShowTooltip({
            anchorRect: titleRef.current.getBoundingClientRect(),
            color: typeof window === 'undefined' ? null : window.getComputedStyle(titleRef.current).color,
            text: title
          })
        }}
        onMouseLeave={() => {
          onHideTooltip()
        }}
        type="button"
      >
        <span className={styles.taskTitleText} ref={titleRef}>
          {title}
        </span>
      </button>
    </div>
  )
}

export const TasksView = ({
  activeTab,
  bindCurrentTask,
  canBindCurrentTask,
  completeTask,
  createTask,
  currentTimerTaskId,
  deleteTask,
  newTaskTitle,
  onActiveTabChange,
  reorderTasks,
  restoreTask,
  setNewTaskTitle,
  startFocusWithTask,
  taskBoard,
  timerContext,
  updateTask
}: TasksViewProps): ReactElement => {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [dragSourceTaskId, setDragSourceTaskId] = useState<string | null>(null)
  const [dragTargetTaskId, setDragTargetTaskId] = useState<string | null>(null)
  const [taskTitleTooltip, setTaskTitleTooltip] = useState<TaskTitleTooltipState | null>(null)
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
    setTaskTitleTooltip(null)
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
      } else if (confirmDialog.kind === 'rebind') {
        await bindCurrentTask(confirmDialog.taskId)
      } else if (confirmDialog.kind === 'startFocusWithTask') {
        await startFocusWithTask(confirmDialog.taskId)
      } else {
        await deleteTask(confirmDialog.taskId)
      }
      setConfirmDialog(null)
    } finally {
      setConfirmPending(false)
    }
  }

  const hideTaskTitleTooltip = useCallback((): void => {
    setTaskTitleTooltip((currentValue) => (currentValue === null ? currentValue : null))
  }, [])

  const showTaskTitleTooltip = useCallback(
    ({ anchorRect, color, text }: { anchorRect: TooltipAnchorRect; color: string | null; text: string }): void => {
    if (typeof window === 'undefined') return

    const layout = getTaskTitleTooltipLayout(anchorRect, window.innerWidth)
    if (!layout) return

    setTaskTitleTooltip({
      color,
      text,
      ...layout
    })
    },
    []
  )

  return (
    <div className={styles.listView}>
      <div className={styles.taskControls}>
        <div className={styles.pageTopper}>
          <div className={styles.pageTopperLeft}>
            <div aria-label="任务筛选" className={styles.taskTabs} role="tablist">
              {taskTabOrder.map((tab) => (
                <button
                  aria-selected={activeTab === tab}
                  className={`${styles.taskTabButton} ${activeTab === tab ? styles.taskTabActive : ''}`}
                  key={tab}
                  onClick={() => {
                    stopEditing()
                    setDragSourceTaskId(null)
                    setDragTargetTaskId(null)
                    onActiveTabChange(tab)
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
          <span>状态</span>
          <span>任务</span>
          <span>统计</span>
          <span>绑定</span>
          <span>操作</span>
        </div>

        <div
          aria-label="任务列表"
          className={styles.denseList}
          onScroll={() => {
            hideTaskTitleTooltip()
          }}
          role="list"
        >
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

                  <span
                    className={`${styles.taskStatusText} ${
                      row.isCompleted ? styles.taskStatusTextDone : styles.taskStatusTextActive
                    }`}
                  >
                    {row.statusLabel}
                  </span>

                  {isEditing ? (
                    <div className={styles.taskMain}>
                      <input
                        autoFocus
                        className={styles.taskTitleInput}
                        onBlur={() => saveEditing(row.id)}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => handleEditKeyDown(event, row.id)}
                        value={draftTitle}
                      />
                    </div>
                  ) : (
                    <TaskTitleButton
                      onHideTooltip={hideTaskTitleTooltip}
                      onShowTooltip={showTaskTitleTooltip}
                      onStartEditing={() => startEditing(row)}
                      title={row.title}
                    />
                  )}

                  <div className={styles.taskStats}>
                    <span className={styles.taskStatsInline}>
                      <span className={styles.taskStatsValue}>{`${row.focusMinutes}m`}</span>
                      <span aria-hidden="true" className={styles.taskStatsSeparator} />
                      <span className={styles.taskStatsValue}>{`${row.completedPomodoros}个番茄钟`}</span>
                    </span>
                  </div>

                  <div className={styles.taskBindCell}>
                    {!row.isCompleted ? (
                      <button
                        aria-label={isBoundToCurrentTimer ? `当前已绑定任务 ${row.title}` : `绑定任务 ${row.title}`}
                        aria-pressed={isBoundToCurrentTimer}
                        className={`${styles.taskBindButton} ${isBoundToCurrentTimer ? styles.taskBindButtonActive : ''}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          const bindAction = resolveTaskBindAction({
                            canBindCurrentTask,
                            currentTimerTaskId,
                            rowId: row.id,
                            timerContext
                          })

                          if (bindAction.kind === 'unbind') {
                            setConfirmDialog({ kind: 'unbind', taskTitle: row.title })
                            return
                          }

                          if (bindAction.kind === 'confirmRebind') {
                            setConfirmDialog({
                              kind: 'rebind',
                              previousTaskTitle: rowById.get(currentTimerTaskId ?? '')?.title ?? '当前任务',
                              taskId: row.id,
                              taskTitle: row.title
                            })
                            return
                          }

                          if (bindAction.kind === 'confirmStartFocusWithTask') {
                            setConfirmDialog({ kind: 'startFocusWithTask', taskId: row.id, taskTitle: row.title })
                            return
                          }

                          if (bindAction.kind === 'startFocusWithTask') {
                            void startFocusWithTask(row.id)
                            return
                          }

                          void bindCurrentTask(row.id)
                        }}
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

      {taskTitleTooltip ? (
        <div
          className={styles.taskTitleTooltip}
          style={{
            color: taskTitleTooltip.color ?? undefined,
            left: `${taskTitleTooltip.left}px`,
            maxWidth: `${taskTitleTooltip.maxWidth}px`,
            top: `${taskTitleTooltip.top}px`
          }}
        >
          {taskTitleTooltip.text}
        </div>
      ) : null}

      {confirmDialog ? (
        <ConfirmModal
          body={
            confirmDialog.kind === 'unbind'
              ? '解绑后当前专注将不再关联该任务。'
              : confirmDialog.kind === 'rebind'
                ? `切换后，当前这轮专注后续记录将关联到任务「${confirmDialog.taskTitle}」，不再继续绑定「${confirmDialog.previousTaskTitle}」。`
              : confirmDialog.kind === 'delete'
                ? '删除后任务会从列表移除，历史专注统计会按“已删除任务”展示。'
                : getTimerActionConfirmation({
                    kind: 'startFocusWithTask',
                    taskTitle: confirmDialog.taskTitle
                  }).body
          }
          confirmLabel={
            confirmDialog.kind === 'unbind'
              ? '确认解绑'
              : confirmDialog.kind === 'rebind'
                ? '确认切换绑定'
              : confirmDialog.kind === 'delete'
                ? '确认删除'
                : getTimerActionConfirmation({
                    kind: 'startFocusWithTask',
                    taskTitle: confirmDialog.taskTitle
                  }).confirmLabel
          }
          onCancel={() => !confirmPending && setConfirmDialog(null)}
          onConfirm={() => void handleConfirmAction()}
          pending={confirmPending}
          subtitle={
            confirmDialog.kind === 'unbind'
              ? '解绑确认'
              : confirmDialog.kind === 'rebind'
                ? '绑定确认'
              : confirmDialog.kind === 'delete'
                ? '删除确认'
                : getTimerActionConfirmation({
                    kind: 'startFocusWithTask',
                    taskTitle: confirmDialog.taskTitle
                  }).subtitle
          }
          title={
            confirmDialog.kind === 'unbind'
              ? `确认解绑任务「${confirmDialog.taskTitle}」吗？`
              : confirmDialog.kind === 'rebind'
                ? `确认将当前专注从任务「${confirmDialog.previousTaskTitle}」切换绑定到「${confirmDialog.taskTitle}」吗？`
              : confirmDialog.kind === 'delete'
                ? `确认删除任务「${confirmDialog.taskTitle}」吗？`
                : getTimerActionConfirmation({
                    kind: 'startFocusWithTask',
                    taskTitle: confirmDialog.taskTitle
                  }).title
          }
          tone={confirmDialog.kind === 'delete' ? 'danger' : 'primary'}
        />
      ) : null}
    </div>
  )
}
