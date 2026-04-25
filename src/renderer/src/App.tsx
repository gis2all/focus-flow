import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { createIdleTimer, deriveTimerSnapshot } from '@core/timer/timerState'
import { defaultSettings } from '@shared/defaults'
import type { AppSettings, FocusStats, TaskBoardSnapshot, TimerPhase, TimerSnapshot } from '@shared/types'
import { AppShell } from './components/AppShell'
import { SettingsView } from './views/SettingsView'
import { StatsView } from './views/StatsView'
import { TasksView } from './views/TasksView'
import { TimerView } from './views/TimerView'
import type { ViewKey } from './types'
import { buildTaskTitleById, resolveEffectiveTheme, resolveSelectedTaskId } from './viewModel'

const fallbackSnapshot = deriveTimerSnapshot(createIdleTimer(defaultSettings, Date.now()), Date.now())

const fallbackStats: FocusStats = {
  today: {
    focusMinutes: 0,
    completedPomodoros: 0,
    completedTasks: 0
  },
  hourlyFocusMinutes: Array.from({ length: 24 }, () => 0),
  weeklyTrend: [],
  taskFocusMinutes: []
}

const fallbackTaskBoard: TaskBoardSnapshot = {
  counts: {
    all: 0,
    active: 0,
    completed: 0
  },
  activeItems: [],
  completedItems: []
}

export const App = (): ReactElement => {
  const [activeView, setActiveView] = useState<ViewKey>('timer')
  const [snapshot, setSnapshot] = useState<TimerSnapshot>(fallbackSnapshot)
  const [taskBoard, setTaskBoard] = useState<TaskBoardSnapshot>(fallbackTaskBoard)
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [stats, setStats] = useState<FocusStats>(fallbackStats)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([
      window.focusFlow.timer.getSnapshot().then(setSnapshot),
      window.focusFlow.tasks.getBoard().then((value) => {
        setTaskBoard(value)
        setSelectedTaskId(resolveSelectedTaskId(value, null))
      }),
      window.focusFlow.settings.get().then(setSettings),
      window.focusFlow.stats.get().then(setStats),
      window.focusFlow.system.getTheme().then(setSystemTheme)
    ])

    return window.focusFlow.timer.onSnapshot((value) => {
      setSnapshot(value)
      void window.focusFlow.stats.get().then(setStats)
    })
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolveEffectiveTheme(settings.themePreference, systemTheme)
  }, [settings.themePreference, systemTheme])

  const activeTheme = resolveEffectiveTheme(settings.themePreference, systemTheme)
  const progressPercent = Math.round(snapshot.progress * 100)
  const selectedTask = taskBoard.activeItems.find((task) => task.id === selectedTaskId) ?? null
  const taskTitleById = useMemo(() => buildTaskTitleById(taskBoard), [taskBoard])
  const currentTaskTitle = snapshot.taskId
    ? taskTitleById[snapshot.taskId] ?? '已删除任务'
    : selectedTask?.title ?? '选择一个任务开始专注'

  const refreshTaskBoardAndStats = async (preferredTaskId = selectedTaskId): Promise<void> => {
    const [nextTaskBoard, nextStats] = await Promise.all([window.focusFlow.tasks.getBoard(), window.focusFlow.stats.get()])
    setTaskBoard(nextTaskBoard)
    setStats(nextStats)
    setSelectedTaskId(resolveSelectedTaskId(nextTaskBoard, preferredTaskId ?? null))
  }

  const createTask = async (): Promise<void> => {
    if (!newTaskTitle.trim()) return
    const task = await window.focusFlow.tasks.create({ title: newTaskTitle })
    setNewTaskTitle('')
    await refreshTaskBoardAndStats(task.id)
  }

  const updateTask = async (id: string, title: string): Promise<void> => {
    const task = await window.focusFlow.tasks.update({ id, title })
    await refreshTaskBoardAndStats(task.id)
  }

  const completeTask = async (id: string): Promise<void> => {
    await window.focusFlow.tasks.complete(id)
    await refreshTaskBoardAndStats(selectedTaskId === id ? null : selectedTaskId)
  }

  const restoreTask = async (id: string): Promise<void> => {
    const task = await window.focusFlow.tasks.restore(id)
    await refreshTaskBoardAndStats(task.id)
  }

  const reorderTasks = async (ids: string[]): Promise<void> => {
    await window.focusFlow.tasks.reorder({ ids })
    await refreshTaskBoardAndStats(selectedTaskId)
  }

  const deleteTask = async (id: string): Promise<void> => {
    await window.focusFlow.tasks.delete(id)
    await refreshTaskBoardAndStats(selectedTaskId === id ? null : selectedTaskId)
  }

  const updateSettings = async (patch: Partial<AppSettings>): Promise<void> => {
    const nextSettings = await window.focusFlow.settings.update({ patch })
    setSettings(nextSettings)
  }

  const startTimer = async (phase: TimerPhase): Promise<void> => {
    setSnapshot(await window.focusFlow.timer.start({ phase, taskId: phase === 'focus' ? selectedTaskId : null }))
  }

  const renderActiveView = (): ReactElement => {
    if (activeView === 'timer') {
      return (
        <TimerView
          currentTaskTitle={currentTaskTitle}
          progressPercent={progressPercent}
          settings={settings}
          snapshot={snapshot}
          startTimer={startTimer}
          updateSettings={updateSettings}
        />
      )
    }

    if (activeView === 'tasks') {
      return (
        <TasksView
          completeTask={completeTask}
          createTask={createTask}
          deleteTask={deleteTask}
          newTaskTitle={newTaskTitle}
          restoreTask={restoreTask}
          reorderTasks={reorderTasks}
          selectedTaskId={selectedTaskId}
          selectedTaskTitle={selectedTask?.title ?? null}
          setNewTaskTitle={setNewTaskTitle}
          setSelectedTaskId={setSelectedTaskId}
          taskBoard={taskBoard}
          updateTask={updateTask}
        />
      )
    }

    if (activeView === 'stats') {
      return <StatsView stats={stats} taskTitleById={taskTitleById} />
    }

    return <SettingsView settings={settings} updateSettings={updateSettings} activeTheme={activeTheme} />
  }

  return (
    <AppShell
      activeTheme={activeTheme}
      activeView={activeView}
      onNavigate={setActiveView}
      onToggleTheme={() => void updateSettings({ themePreference: activeTheme === 'dark' ? 'light' : 'dark' })}
    >
      {renderActiveView()}
    </AppShell>
  )
}
