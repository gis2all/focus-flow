import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { TaskBoardSnapshot, TimerPhase, TimerStatus } from '@shared/types'
import { getTaskTitleTooltipLayout, isTaskTitleOverflowing, resolveTaskBindAction, TaskTooltipBubble, TasksView } from './TasksView'

const LONG_TASK_TITLE = '这是一个很长很长的任务标题，用来验证悬浮时可以看到完整内容'

const createBoard = (): TaskBoardSnapshot => ({
  counts: {
    all: 3,
    active: 2,
    completed: 1
  },
  activeItems: [
    {
      id: 'task-a',
      title: LONG_TASK_TITLE,
      sortOrder: 1,
      completedAt: null,
      createdAt: '2026-04-25T09:00:00.000Z',
      updatedAt: '2026-04-25T09:00:00.000Z',
      focusMinutes: 75,
      completedPomodoros: 1
    },
    {
      id: 'task-b',
      title: '任务 B',
      sortOrder: 2,
      completedAt: null,
      createdAt: '2026-04-25T09:01:00.000Z',
      updatedAt: '2026-04-25T09:01:00.000Z',
      focusMinutes: 0,
      completedPomodoros: 0
    }
  ],
  completedItems: [
    {
      id: 'task-c',
      title: '任务 C',
      sortOrder: 0,
      completedAt: '2026-04-25T10:00:00.000Z',
      createdAt: '2026-04-25T09:02:00.000Z',
      updatedAt: '2026-04-25T10:00:00.000Z',
      focusMinutes: 50,
      completedPomodoros: 2
    }
  ]
})

const createBoardWithTabCounts = (): TaskBoardSnapshot => ({
  ...createBoard(),
  counts: {
    all: 15,
    active: 4,
    completed: 11
  }
})

const noopAsync = async (): Promise<void> => undefined
const noop = (): void => undefined
const createTimerContext = (status: TimerStatus, phase: TimerPhase) => ({ status, phase })

describe('TasksView', () => {
  test('requires confirmation before rebinding the current focus to another task', () => {
    expect(
      resolveTaskBindAction({
        canBindCurrentTask: true,
        currentTimerTaskId: 'task-a',
        rowId: 'task-b',
        timerContext: createTimerContext('running', 'focus')
      })
    ).toEqual({ kind: 'confirmRebind' })
  })

  test('binds directly when the current focus session has no bound task yet', () => {
    expect(
      resolveTaskBindAction({
        canBindCurrentTask: true,
        currentTimerTaskId: null,
        rowId: 'task-b',
        timerContext: createTimerContext('running', 'focus')
      })
    ).toEqual({ kind: 'bind' })
  })

  test('仅在任务标题实际被截断时才显示 tooltip', () => {
    expect(isTaskTitleOverflowing({ clientWidth: 180, scrollWidth: 181 })).toBe(true)
    expect(isTaskTitleOverflowing({ clientWidth: 180, scrollWidth: 180 })).toBe(false)
    expect(isTaskTitleOverflowing({ clientWidth: 180, scrollWidth: 120 })).toBe(false)
    expect(isTaskTitleOverflowing(null)).toBe(false)
  })

  test('任务标题 tooltip 固定在上方并在视口内横向夹取', () => {
    expect(getTaskTitleTooltipLayout({ left: 180, top: 132 }, 900)).toEqual({
      left: 180,
      maxWidth: 420,
      top: 124
    })

    expect(getTaskTitleTooltipLayout({ left: 520, top: 132 }, 560)).toEqual({
      left: 128,
      maxWidth: 420,
      top: 124
    })
  })

  test('完成列 tooltip 复用任务 tooltip 的样式和 role', () => {
    const html = renderToStaticMarkup(
      <TaskTooltipBubble
        tooltip={{
          color: '#aebdd0',
          left: 180,
          maxWidth: 240,
          text: '完成任务',
          top: 124
        }}
      />
    )

    expect(html).toContain('role="tooltip"')
    expect(html).toContain('taskTitleTooltip')
    expect(html).toContain('完成任务')
  })

  test('任务筛选按进行中 已完成 全部的顺序展示', () => {
    const html = renderToStaticMarkup(
      <TasksView
        activeTab="all"
        bindCurrentTask={noopAsync}
        canBindCurrentTask
        completeTask={noopAsync}
        createTask={noopAsync}
        currentTimerTaskId="task-a"
        deleteTask={noopAsync}
        newTaskTitle=""
        onActiveTabChange={noop}
        reorderTasks={noopAsync}
        restoreTask={noopAsync}
        setNewTaskTitle={() => undefined}
        startFocusWithTask={noopAsync}
        taskBoard={createBoardWithTabCounts()}
        timerContext={createTimerContext('running', 'focus')}
        updateTask={async () => undefined}
      />
    )

    const activeIndex = html.indexOf('>进行中</span><b>4</b>')
    const completedIndex = html.indexOf('>已完成</span><b>11</b>')
    const allIndex = html.indexOf('>全部</span><b>15</b>')

    expect(activeIndex).toBeGreaterThanOrEqual(0)
    expect(completedIndex).toBeGreaterThan(activeIndex)
    expect(allIndex).toBeGreaterThan(completedIndex)
  })

  test('渲染清晰的任务区列结构和当前绑定操作', () => {
    const html = renderToStaticMarkup(
      <TasksView
        activeTab="all"
        bindCurrentTask={noopAsync}
        canBindCurrentTask
        completeTask={noopAsync}
        createTask={noopAsync}
        currentTimerTaskId="task-a"
        deleteTask={noopAsync}
        newTaskTitle=""
        onActiveTabChange={noop}
        reorderTasks={noopAsync}
        restoreTask={noopAsync}
        setNewTaskTitle={() => undefined}
        startFocusWithTask={noopAsync}
        taskBoard={createBoard()}
        timerContext={createTimerContext('running', 'focus')}
        updateTask={async () => undefined}
      />
    )

    expect(html).not.toContain('下一轮任务')
    expect(html).toContain('aria-label="任务筛选"')
    expect(html).toContain('aria-label="任务列表"')
    expect(html).toContain('role="list"')
    expect(html).toContain('data-task-surface="floating-card"')
    expect(html).toContain('data-current-task="true"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).not.toContain('title="完成任务"')
    expect(html).not.toContain('title="恢复任务"')
    expect(html).not.toContain('data-full-title=')
    expect(html).toContain('>完成<')
    expect(html).toContain('>任务<')
    expect(html).toContain('>状态<')
    expect(html).toContain('>统计<')
    expect(html).toContain('>绑定<')
    expect(html).toContain('>操作<')
    expect(html).toContain('>进行中<')
    expect(html).toContain('1h 15m')
    expect(html).toContain('1 番茄钟')
    expect(html).not.toContain('1h 15m | 1 番茄钟')
    expect(html).toContain('>已绑定<')
    expect(html).toContain('>绑定<')
    expect(html).toContain('>删除<')
  })

  test('非运行专注时显示设为当前且不显示底部提示', () => {
    const html = renderToStaticMarkup(
      <TasksView
        activeTab="active"
        bindCurrentTask={noopAsync}
        canBindCurrentTask={false}
        completeTask={noopAsync}
        createTask={noopAsync}
        currentTimerTaskId={null}
        deleteTask={noopAsync}
        newTaskTitle=""
        onActiveTabChange={noop}
        reorderTasks={noopAsync}
        restoreTask={noopAsync}
        setNewTaskTitle={() => undefined}
        startFocusWithTask={noopAsync}
        taskBoard={createBoard()}
        timerContext={createTimerContext('paused', 'shortBreak')}
        updateTask={async () => undefined}
      />
    )

    expect(html).toContain('aria-label="新增任务"')
    expect(html).toContain('data-current-task="false"')
    expect(html).toContain('>设为当前<')
    expect(html).not.toContain('点击“设为当前”会启动专注并绑定到该任务。')
    expect(html).not.toContain('拖拽进行中任务可调整顺序。')
  })

  test('uses the provided active tab instead of resetting internally', () => {
    const html = renderToStaticMarkup(
      <TasksView
        activeTab="completed"
        bindCurrentTask={noopAsync}
        canBindCurrentTask={false}
        completeTask={noopAsync}
        createTask={noopAsync}
        currentTimerTaskId={null}
        deleteTask={noopAsync}
        newTaskTitle=""
        onActiveTabChange={noop}
        reorderTasks={noopAsync}
        restoreTask={noopAsync}
        setNewTaskTitle={() => undefined}
        startFocusWithTask={noopAsync}
        taskBoard={createBoard()}
        timerContext={createTimerContext('paused', 'shortBreak')}
        updateTask={async () => undefined}
      />
    )

    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('任务 C')
    expect(html).not.toContain('任务 A')
  })

  test('renders a completion date column with MM-DD labels only for completed tasks', () => {
    const html = renderToStaticMarkup(
      <TasksView
        activeTab="all"
        bindCurrentTask={noopAsync}
        canBindCurrentTask={false}
        completeTask={noopAsync}
        createTask={noopAsync}
        currentTimerTaskId={null}
        deleteTask={noopAsync}
        newTaskTitle=""
        onActiveTabChange={noop}
        reorderTasks={noopAsync}
        restoreTask={noopAsync}
        setNewTaskTitle={() => undefined}
        startFocusWithTask={noopAsync}
        taskBoard={createBoard()}
        timerContext={createTimerContext('paused', 'shortBreak')}
        updateTask={async () => undefined}
      />
    )

    const taskIndex = html.indexOf('>任务<')
    const dateIndex = html.indexOf('>完成日期<')
    const statusIndex = html.indexOf('>状态<')

    expect(taskIndex).toBeGreaterThanOrEqual(0)
    expect(dateIndex).toBeGreaterThan(taskIndex)
    expect(statusIndex).toBeGreaterThan(dateIndex)
    expect(html).toContain('04-25')
    expect((html.match(/04-25/g) ?? []).length).toBe(1)
  })
})
