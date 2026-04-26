import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { TaskBoardSnapshot } from '@shared/types'
import { TasksView } from './TasksView'

const createBoard = (): TaskBoardSnapshot => ({
  counts: {
    all: 3,
    active: 2,
    completed: 1
  },
  activeItems: [
    {
      id: 'task-a',
      title: '任务 A',
      sortOrder: 1,
      completedAt: null,
      createdAt: '2026-04-25T09:00:00.000Z',
      updatedAt: '2026-04-25T09:00:00.000Z',
      focusMinutes: 25,
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

const noopAsync = async (): Promise<void> => undefined

describe('TasksView', () => {
  test('渲染清晰的任务区列结构和当前绑定操作', () => {
    const html = renderToStaticMarkup(
      <TasksView
        bindCurrentTask={noopAsync}
        canBindCurrentTask
        completeTask={noopAsync}
        createTask={noopAsync}
        currentTimerTaskId="task-a"
        deleteTask={noopAsync}
        newTaskTitle=""
        reorderTasks={noopAsync}
        restoreTask={noopAsync}
        setNewTaskTitle={() => undefined}
        startFocusWithTask={noopAsync}
        taskBoard={createBoard()}
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
    expect(html).not.toContain('title="')
    expect(html).toContain('>完成<')
    expect(html).toContain('>状态<')
    expect(html).toContain('>任务<')
    expect(html).toContain('>统计<')
    expect(html).toContain('>绑定<')
    expect(html).toContain('>操作<')
    expect(html).toContain('>进行中<')
    expect(html).toContain('25m')
    expect(html).toContain('1个番茄钟')
    expect(html).not.toContain('25m | 1个番茄钟')
    expect(html).toContain('>已绑定<')
    expect(html).toContain('>绑定<')
    expect(html).toContain('>删除<')
  })

  test('非运行专注时显示设为当前且不显示底部提示', () => {
    const html = renderToStaticMarkup(
      <TasksView
        bindCurrentTask={noopAsync}
        canBindCurrentTask={false}
        completeTask={noopAsync}
        createTask={noopAsync}
        currentTimerTaskId={null}
        deleteTask={noopAsync}
        newTaskTitle=""
        reorderTasks={noopAsync}
        restoreTask={noopAsync}
        setNewTaskTitle={() => undefined}
        startFocusWithTask={noopAsync}
        taskBoard={createBoard()}
        updateTask={async () => undefined}
      />
    )

    expect(html).toContain('aria-label="新增任务"')
    expect(html).toContain('data-current-task="false"')
    expect(html).toContain('>设为当前<')
    expect(html).not.toContain('点击“设为当前”会启动专注并绑定到该任务。')
    expect(html).not.toContain('拖拽进行中任务可调整顺序。')
  })
})
