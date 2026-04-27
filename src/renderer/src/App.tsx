import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createIdleTimer, deriveTimerSnapshot } from '@core/timer/timerState'
import { defaultSettings } from '@shared/defaults'
import type { AppSettings, FocusStats, MonthStats, TaskBoardSnapshot, TimerPhase, TimerSnapshot } from '@shared/types'
import { MINI_WINDOW_SIZE } from '@shared/windowMetrics'
import { AppShell } from './components/AppShell'
import type { WindowMode } from './types'
import { SettingsView } from './views/SettingsView'
import { MiniTimerView } from './views/MiniTimerView'
import { StatsView, type CalendarMonthDirection, type StatsTab } from './views/StatsView'
import { TasksView } from './views/TasksView'
import { TimerView } from './views/TimerView'
import type { ViewKey } from './types'
import {
  buildTaskTitleById,
  getSmoothedTimerProgress,
  resolveCurrentTaskTitle,
  resolveEffectiveTheme,
  resolveTimerPomodoroDisplay,
  type TaskViewTab
} from './viewModel'

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
  taskFocusMinutes: [],
  unboundFocusMinutes: 0
}

interface StatsMonth {
  year: number
  month: number
}

const getStatsMonth = (date = new Date()): StatsMonth => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1
})

const compareStatsMonths = (left: StatsMonth, right: StatsMonth): number =>
  left.year === right.year ? left.month - right.month : left.year - right.year

const getAdjacentStatsMonth = (month: StatsMonth, direction: CalendarMonthDirection): StatsMonth => {
  const date = new Date(month.year, month.month - 1 + (direction === 'previous' ? -1 : 1), 1)
  return getStatsMonth(date)
}

const createEmptyMonthStats = ({ year, month }: StatsMonth): MonthStats => {
  const dayCount = new Date(year, month, 0).getDate()
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
    return {
      date,
      focusMinutes: 0,
      completedPomodoros: 0,
      completedTasks: 0,
      shortBreakMinutes: 0,
      longBreakMinutes: 0,
      isFuture: date > todayKey
    }
  })

  return {
    year,
    month,
    summary: {
      focusMinutes: 0,
      completedPomodoros: 0,
      completedTasks: 0,
      shortBreakMinutes: 0,
      longBreakMinutes: 0
    },
    days,
    maxFocusMinutes: 0
  }
}

const initialStatsMonth = getStatsMonth()

const fallbackTaskBoard: TaskBoardSnapshot = {
  counts: {
    all: 0,
    active: 0,
    completed: 0
  },
  activeItems: [],
  completedItems: []
}

interface AppProps {
  windowMode: WindowMode
}

export const App = ({ windowMode }: AppProps): ReactElement => {
  const [activeView, setActiveView] = useState<ViewKey>('timer')
  const [snapshot, setSnapshot] = useState<TimerSnapshot>(fallbackSnapshot)
  const [taskBoard, setTaskBoard] = useState<TaskBoardSnapshot>(fallbackTaskBoard)
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [stats, setStats] = useState<FocusStats>(fallbackStats)
  const [activeStatsTab, setActiveStatsTab] = useState<StatsTab>('today')
  const [selectedStatsMonth, setSelectedStatsMonth] = useState<StatsMonth>(initialStatsMonth)
  const [monthStats, setMonthStats] = useState<MonthStats>(createEmptyMonthStats(initialStatsMonth))
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [tasksActiveTab, setTasksActiveTab] = useState<TaskViewTab>('active')
  const [displayProgress, setDisplayProgress] = useState(fallbackSnapshot.progress)
  const previousSnapshotRef = useRef<TimerSnapshot>(fallbackSnapshot)
  const selectedStatsMonthRef = useRef<StatsMonth>(initialStatsMonth)

  const refreshTaskBoard = async (): Promise<void> => {
    setTaskBoard(await window.focusFlow.tasks.getBoard())
  }

  const refreshTaskBoardAndStats = async (): Promise<void> => {
    const [nextTaskBoard, nextStats, nextMonthStats] = await Promise.all([
      window.focusFlow.tasks.getBoard(),
      window.focusFlow.stats.get(),
      window.focusFlow.stats.getMonth(selectedStatsMonthRef.current)
    ])
    setTaskBoard(nextTaskBoard)
    setStats(nextStats)
    setMonthStats(nextMonthStats)
  }

  const changeCalendarMonth = async (direction: CalendarMonthDirection): Promise<void> => {
    const nextMonth = getAdjacentStatsMonth(selectedStatsMonthRef.current, direction)
    if (compareStatsMonths(nextMonth, getStatsMonth()) > 0) return
    selectedStatsMonthRef.current = nextMonth
    setSelectedStatsMonth(nextMonth)
    setMonthStats(await window.focusFlow.stats.getMonth(nextMonth))
  }

  useEffect(() => {
    if (windowMode === 'mini') {
      void Promise.all([
        window.focusFlow.timer.getSnapshot(),
        window.focusFlow.settings.get().then(setSettings),
        window.focusFlow.system.getTheme().then(setSystemTheme)
      ]).then(([nextSnapshot]) => {
        previousSnapshotRef.current = nextSnapshot
        setSnapshot(nextSnapshot)
        setDisplayProgress(nextSnapshot.progress)
      })
    } else {
      void Promise.all([
        window.focusFlow.timer.getSnapshot(),
        window.focusFlow.tasks.getBoard(),
        window.focusFlow.settings.get(),
        window.focusFlow.stats.get(),
        window.focusFlow.stats.getMonth(initialStatsMonth),
        window.focusFlow.system.getTheme()
      ]).then(([nextSnapshot, nextTaskBoard, nextSettings, nextStats, nextMonthStats, nextTheme]) => {
        previousSnapshotRef.current = nextSnapshot
        setSnapshot(nextSnapshot)
        setDisplayProgress(nextSnapshot.progress)
        setTaskBoard(nextTaskBoard)
        setSettings(nextSettings)
        setStats(nextStats)
        setMonthStats(nextMonthStats)
        setSystemTheme(nextTheme)
      })
    }

    return window.focusFlow.timer.onSnapshot((value) => {
      const previousSnapshot = previousSnapshotRef.current
      previousSnapshotRef.current = value
      setSnapshot(value)
      setDisplayProgress(value.progress)

      if (windowMode === 'mini') {
        return
      }

      const shouldRefreshTaskBoard =
        previousSnapshot.sessionId !== value.sessionId ||
        (previousSnapshot.status !== 'completed' && value.status === 'completed')

      if (shouldRefreshTaskBoard) {
        void refreshTaskBoardAndStats()
      }
    })
  }, [windowMode])

  useEffect(() => {
    document.documentElement.dataset.theme = resolveEffectiveTheme(settings.themePreference, systemTheme)
  }, [settings.themePreference, systemTheme])

  useEffect(() => {
    selectedStatsMonthRef.current = selectedStatsMonth
  }, [selectedStatsMonth])

  useEffect(() => {
    if (windowMode !== 'mini') return

    void window.focusFlow.system.resizeWindow(MINI_WINDOW_SIZE)
  }, [windowMode, MINI_WINDOW_SIZE.height, MINI_WINDOW_SIZE.width])

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

  if (windowMode === 'mini') {
    return <MiniTimerView activeTheme={activeTheme} settings={settings} snapshot={snapshot} />
  }

  const progressPercent = displayProgress * 100
  const taskTitleById = useMemo(() => buildTaskTitleById(taskBoard), [taskBoard])
  const currentTaskTitle = resolveCurrentTaskTitle(snapshot, taskTitleById)
  const pomodoroDisplay = useMemo(() => resolveTimerPomodoroDisplay(snapshot, taskBoard), [snapshot, taskBoard])

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
          pomodoroDisplay={pomodoroDisplay}
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
          activeTab={tasksActiveTab}
          bindCurrentTask={bindCurrentTask}
          canBindCurrentTask={snapshot.status === 'running' && snapshot.phase === 'focus'}
          startFocusWithTask={startFocusWithTask}
          completeTask={completeTask}
          currentTimerTaskId={snapshot.taskId}
          createTask={createTask}
          deleteTask={deleteTask}
          newTaskTitle={newTaskTitle}
          onActiveTabChange={setTasksActiveTab}
          restoreTask={restoreTask}
          reorderTasks={reorderTasks}
          setNewTaskTitle={setNewTaskTitle}
          taskBoard={taskBoard}
          timerContext={{ status: snapshot.status, phase: snapshot.phase }}
          updateTask={updateTask}
        />
      )
    }

    if (activeView === 'stats') {
      return (
        <StatsView
          activeStatsTab={activeStatsTab}
          canGoToNextMonth={compareStatsMonths(selectedStatsMonth, getStatsMonth()) < 0}
          monthStats={monthStats}
          onCalendarMonthChange={(direction) => void changeCalendarMonth(direction)}
          onStatsTabChange={setActiveStatsTab}
          stats={stats}
        />
      )
    }

    return <SettingsView settings={settings} updateSettings={updateSettings} activeTheme={activeTheme} />
  }

  return (
    <AppShell
      activeTheme={activeTheme}
      activeView={activeView}
      onNavigate={setActiveView}
      onShowMiniWindow={() => void window.focusFlow.system.showMiniWindow()}
      onToggleTheme={() => void updateSettings({ themePreference: activeTheme === 'dark' ? 'light' : 'dark' })}
    >
      {renderActiveView()}
    </AppShell>
  )
}
