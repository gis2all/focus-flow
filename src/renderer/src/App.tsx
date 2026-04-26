import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createIdleTimer, deriveTimerSnapshot } from '@core/timer/timerState'
import { defaultSettings } from '@shared/defaults'
import type { AppSettings, FocusStats, TaskBoardSnapshot, TimerPhase, TimerSnapshot } from '@shared/types'
import { AppShell } from './components/AppShell'
import { SettingsView } from './views/SettingsView'
import { StatsView } from './views/StatsView'
import { TasksView } from './views/TasksView'
import { TimerView } from './views/TimerView'
import type { ViewKey } from './types'
import { buildTaskTitleById, getSmoothedTimerProgress, resolveCurrentTaskTitle, resolveEffectiveTheme } from './viewModel'

const fallbackSnapshot = deriveTimerSnapshot(createIdleTimer(defaultSettings, Date.now()), Date.now())

const fallbackStats: FocusStats = {
  today: {
    focusMinutes: 0,
    shortBreakMinutes: 0,
    longBreakMinutes: 0,
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
  const [displayProgress, setDisplayProgress] = useState(fallbackSnapshot.progress)
  const previousSnapshotRef = useRef<TimerSnapshot>(fallbackSnapshot)

  const refreshTaskBoard = async (): Promise<void> => {
    setTaskBoard(await window.focusFlow.tasks.getBoard())
  }

  const refreshTaskBoardAndStats = async (): Promise<void> => {
    const [nextTaskBoard, nextStats] = await Promise.all([window.focusFlow.tasks.getBoard(), window.focusFlow.stats.get()])
    setTaskBoard(nextTaskBoard)
    setStats(nextStats)
  }

  useEffect(() => {
    void Promise.all([
      window.focusFlow.timer.getSnapshot(),
      window.focusFlow.tasks.getBoard(),
      window.focusFlow.settings.get().then(setSettings),
      window.focusFlow.stats.get().then(setStats),
      window.focusFlow.system.getTheme().then(setSystemTheme)
    ]).then(([nextSnapshot, nextTaskBoard]) => {
      previousSnapshotRef.current = nextSnapshot
      setSnapshot(nextSnapshot)
      setDisplayProgress(nextSnapshot.progress)
      setTaskBoard(nextTaskBoard)
    })

    return window.focusFlow.timer.onSnapshot((value) => {
      const previousSnapshot = previousSnapshotRef.current
      previousSnapshotRef.current = value
      setSnapshot(value)
      setDisplayProgress(value.progress)

      const shouldRefreshTaskBoard =
        previousSnapshot.sessionId !== value.sessionId ||
        (previousSnapshot.status !== 'completed' && value.status === 'completed')

      if (shouldRefreshTaskBoard) {
        void refreshTaskBoardAndStats()
      }
    })
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolveEffectiveTheme(settings.themePreference, systemTheme)
  }, [settings.themePreference, systemTheme])

  useEffect(() => {
    if (snapshot.status !== 'running') {
      setDisplayProgress(snapshot.progress)
      return
    }

    let frameId = 0

    const updateFrame = () => {
      setDisplayProgress(getSmoothedTimerProgress(snapshot, Date.now()))
      frameId = window.requestAnimationFrame(updateFrame)
    }

    updateFrame()

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [snapshot])

  const activeTheme = resolveEffectiveTheme(settings.themePreference, systemTheme)
  const progressPercent = displayProgress * 100
  const taskTitleById = useMemo(() => buildTaskTitleById(taskBoard), [taskBoard])
  const currentTaskTitle = resolveCurrentTaskTitle(snapshot, taskTitleById)

  const createTask = async (): Promise<void> => {
    if (!newTaskTitle.trim()) return
    await window.focusFlow.tasks.create({ title: newTaskTitle })
    setNewTaskTitle('')
    await refreshTaskBoardAndStats()
  }

  const updateTask = async (id: string, title: string): Promise<void> => {
    await window.focusFlow.tasks.update({ id, title })
    await refreshTaskBoard()
  }

  const completeTask = async (id: string): Promise<void> => {
    await window.focusFlow.tasks.complete(id)
    await refreshTaskBoardAndStats()
  }

  const restoreTask = async (id: string): Promise<void> => {
    await window.focusFlow.tasks.restore(id)
    await refreshTaskBoardAndStats()
  }

  const reorderTasks = async (ids: string[]): Promise<void> => {
    await window.focusFlow.tasks.reorder({ ids })
    await refreshTaskBoard()
  }

  const deleteTask = async (id: string): Promise<void> => {
    await window.focusFlow.tasks.delete(id)
    await refreshTaskBoardAndStats()
  }

  const bindCurrentTask = async (taskId: string | null): Promise<void> => {
    setSnapshot(await window.focusFlow.timer.bindCurrentTask(taskId))
  }

  const startFocusWithTask = async (taskId: string): Promise<void> => {
    setSnapshot(await window.focusFlow.timer.start({ phase: 'focus', taskId }))
  }

  const updateSettings = async (patch: Partial<AppSettings>): Promise<void> => {
    const nextSettings = await window.focusFlow.settings.update({ patch })
    setSettings(nextSettings)
  }

  const startTimer = async (phase: TimerPhase): Promise<void> => {
    setSnapshot(await window.focusFlow.timer.start({ phase }))
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
          bindCurrentTask={bindCurrentTask}
          canBindCurrentTask={snapshot.status === 'running' && snapshot.phase === 'focus'}
          startFocusWithTask={startFocusWithTask}
          completeTask={completeTask}
          currentTimerTaskId={snapshot.taskId}
          createTask={createTask}
          deleteTask={deleteTask}
          newTaskTitle={newTaskTitle}
          restoreTask={restoreTask}
          reorderTasks={reorderTasks}
          setNewTaskTitle={setNewTaskTitle}
          taskBoard={taskBoard}
          updateTask={updateTask}
        />
      )
    }

    if (activeView === 'stats') {
      return <StatsView stats={stats} taskBoard={taskBoard} />
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
