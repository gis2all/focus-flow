import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  nativeTheme,
  screen,
  Tray,
  type MessageBoxSyncOptions
} from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import log from 'electron-log'
import type { AppSettings } from '@shared/types'
import { createSqliteAppDatabase } from '@main/adapters/sqlite/sqliteDatabase'
import {
  ElectronAutoLaunchAdapter,
  ElectronNotificationAdapter,
  ElectronSoundAdapter,
  ElectronSystemThemeAdapter,
  SystemClock
} from '@main/adapters/desktop'
import { resolveWindowsAppUserModelId } from '@main/adapters/notificationHelpers'
import { registerIpcHandlers } from '@main/ipc/registerIpcHandlers'
import {
  SqliteAppEventRepository,
  SqliteSettingsRepository,
  SqliteTaskRepository,
  SqliteTimerRuntimeRepository,
  SqliteTimerSessionRepository
} from '@main/repositories/sqliteRepositories'
import { SettingsService } from '@main/services/settingsService'
import { StatsService } from '@main/services/statsService'
import { TaskBoardService } from '@main/services/taskBoardService'
import { TaskDeletionService } from '@main/services/taskDeletionService'
import { TaskService } from '@main/services/taskService'
import { TimerService } from '@main/services/timerService'
import { createBroadcastTimerSnapshot, createTimerTickRunner } from '@main/timerSnapshotBroadcast'
import { buildTrayMenuTemplate } from './trayMenu'
import {
  MINI_WINDOW_HEIGHT,
  MINI_WINDOW_WIDTH,
  activateMainWindow,
  activateMiniWindow,
  createMiniWindowChromeOptions,
  resolveMiniWindowPosition
} from './windowing'

const __dirname = dirname(fileURLToPath(import.meta.url))
const getAssetPath = (...segments: string[]) => join(app.getAppPath(), ...segments)
const getRuntimeAssetPath = (...segments: string[]) =>
  app.isPackaged
    ? join(process.resourcesPath, 'app-assets', ...segments)
    : getAssetPath('main', 'assets', ...segments)

let mainWindow: BrowserWindow | null = null
let miniWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let preferredWindowMode: 'main' | 'mini' = 'main'
let shouldRestorePreferredWindow = false
let lastMiniWindowPosition: { x: number; y: number } | null = null

const loadRendererWindow = (window: BrowserWindow, mode: 'main' | 'mini'): void => {
  if (process.env.ELECTRON_RENDERER_URL) {
    const rendererUrl = new URL(process.env.ELECTRON_RENDERER_URL)
    rendererUrl.searchParams.set('window', mode)
    void window.loadURL(rendererUrl.toString())
    return
  }

  void window.loadFile(join(__dirname, '../renderer/index.html'), {
    query: {
      window: mode
    }
  })
}

const loadTrayImage = (...segments: string[]) => {
  const image = nativeImage.createFromPath(getRuntimeAssetPath(...segments))
  if (image.isEmpty()) return null

  return image.resize({
    width: 16,
    height: 16,
    quality: 'best'
  })
}

const createTrayImage = (shouldUseDarkColors: boolean) =>
  loadTrayImage(shouldUseDarkColors ? 'focusflow-tray-dark.png' : 'focusflow-tray.png') ??
  loadTrayImage('focusflow-tray.png') ??
  loadTrayImage('focusflow-icon.ico') ??
  nativeImage.createEmpty()

const applyNativeThemePreference = (preference: AppSettings['themePreference']) => {
  nativeTheme.themeSource = preference
}

// Electron measures BrowserWindow sizes in logical pixels, not physical pixels.
// The live main window currently lands at 888x760 logical px on a 125% scaled
// display (1110x950 physical px), so keep the startup height and minimum height
// pinned to that verified layout to avoid future clipping regressions.
const MAIN_WINDOW_WIDTH = 888
const MAIN_WINDOW_HEIGHT = 760

if (process.platform === 'win32') {
  app.setAppUserModelId(resolveWindowsAppUserModelId(app.isPackaged, process.execPath))
}

const focusPreferredWindow = (): void => {
  if (preferredWindowMode === 'mini' && miniWindow && !miniWindow.isDestroyed()) {
    activateMiniWindow(mainWindow, miniWindow)
    return
  }

  if (mainWindow) {
    activateMainWindow(mainWindow, miniWindow)
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow || miniWindow) {
      focusPreferredWindow()
      return
    }

    shouldRestorePreferredWindow = true
  })
}

const createMainWindow = (startHidden: boolean): BrowserWindow => {
  const shouldStartHidden = process.argv.includes('--hidden') || startHidden
  const window = new BrowserWindow({
    width: MAIN_WINDOW_WIDTH,
    height: MAIN_WINDOW_HEIGHT,
    minWidth: MAIN_WINDOW_WIDTH,
    minHeight: MAIN_WINDOW_HEIGHT,
    show: !shouldStartHidden,
    frame: false,
    title: 'FocusFlow',
    autoHideMenuBar: true,
    backgroundColor: '#f4f7fb',
    icon: getRuntimeAssetPath('focusflow-icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const showWhenReady = (): void => {
    if (!shouldStartHidden && !window.isVisible()) {
      window.show()
      window.focus()
    }
  }

  window.once('ready-to-show', showWhenReady)
  window.webContents.once('did-finish-load', () => {
    setTimeout(showWhenReady, 50)
  })
  setTimeout(showWhenReady, 2_000)
  loadRendererWindow(window, 'main')

  return window
}

const createMiniWindow = (position: { x: number; y: number }): BrowserWindow => {
  const window = new BrowserWindow({
    ...createMiniWindowChromeOptions(position),
    title: 'FocusFlow Mini',
    icon: getRuntimeAssetPath('focusflow-icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  loadRendererWindow(window, 'mini')
  return window
}

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)

  const clock = new SystemClock()
  const database = await createSqliteAppDatabase(join(app.getPath('userData'), 'focusflow.sqlite'))
  const taskRepository = new SqliteTaskRepository(database)
  const sessionRepository = new SqliteTimerSessionRepository(database)
  const runtimeRepository = new SqliteTimerRuntimeRepository(database)
  const settingsRepository = new SqliteSettingsRepository(database)
  const eventRepository = new SqliteAppEventRepository(database)
  const theme = new ElectronSystemThemeAdapter()
  const settings = new SettingsService(settingsRepository, new ElectronAutoLaunchAdapter())
  const tasks = new TaskService(taskRepository)
  const taskBoard = new TaskBoardService(taskRepository, sessionRepository)
  const stats = new StatsService(sessionRepository, taskRepository, clock)

  const getWindows = (): BrowserWindow[] =>
    [mainWindow, miniWindow].filter((window): window is BrowserWindow => window !== null && !window.isDestroyed())

  const broadcastTimerSnapshot = createBroadcastTimerSnapshot(getWindows)

  const saveMiniWindowPosition = async (): Promise<void> => {
    if (!miniWindow || miniWindow.isDestroyed()) return
    const [x, y] = miniWindow.getPosition()
    lastMiniWindowPosition = { x, y }
  }

  const destroyMiniWindow = async (): Promise<void> => {
    if (!miniWindow) return
    const window = miniWindow
    await saveMiniWindowPosition()
    miniWindow = null
    if (!window.isDestroyed()) {
      window.destroy()
    }
  }

  const showMainWindow = async (): Promise<void> => {
    if (!mainWindow) return
    preferredWindowMode = 'main'
    await destroyMiniWindow()
    activateMainWindow(mainWindow)
  }

  const showMiniWindow = async (): Promise<void> => {
    if (!mainWindow) return
    preferredWindowMode = 'mini'

    if (miniWindow && !miniWindow.isDestroyed()) {
      const [x, y] = miniWindow.getPosition()
      miniWindow.setMinimumSize(MINI_WINDOW_WIDTH, MINI_WINDOW_HEIGHT)
      miniWindow.setMaximumSize(MINI_WINDOW_WIDTH, MINI_WINDOW_HEIGHT)
      miniWindow.setContentSize(MINI_WINDOW_WIDTH, MINI_WINDOW_HEIGHT)
      miniWindow.setBounds({
        x,
        y,
        width: MINI_WINDOW_WIDTH,
        height: MINI_WINDOW_HEIGHT
      })
      activateMiniWindow(mainWindow, miniWindow)
      return
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const position = resolveMiniWindowPosition({
      savedPosition: lastMiniWindowPosition,
      displays: [primaryDisplay, ...screen.getAllDisplays().filter((display) => display.id !== primaryDisplay.id)]
    })

    mainWindow.hide()

    const window = createMiniWindow(position)
    miniWindow = window

    window.once('ready-to-show', () => {
      if (miniWindow !== window || window.isDestroyed()) return
      activateMiniWindow(mainWindow, window)
    })

    window.on('close', (event) => {
      if (isQuitting) return
      event.preventDefault()
      void showMainWindow().catch((error) => log.error(error))
    })

    window.on('closed', () => {
      if (miniWindow === window) {
        miniWindow = null
      }
    })
  }

  const timer = new TimerService({
    sessions: sessionRepository,
    settings,
    runtime: runtimeRepository,
    events: eventRepository,
    tasks: taskRepository,
    clock,
    notifier: new ElectronNotificationAdapter({
      iconPath: getRuntimeAssetPath('focusflow-icon.png'),
      onClick: () => {
        void showMainWindow().catch((error) => log.error(error))
      }
    }),
    sound: new ElectronSoundAdapter()
  })
  const taskDeletion = new TaskDeletionService({
    tasks: taskRepository,
    sessions: sessionRepository,
    timer
  })
  const runTimerTick = createTimerTickRunner({
    timer,
    onError: (error) => log.error(error)
  })
  const unsubscribeTimerSnapshotBroadcast = timer.onSnapshot(broadcastTimerSnapshot)

  await timer.initialize()

  const startupSettings = await settings.get()
  applyNativeThemePreference(startupSettings.themePreference)
  mainWindow = createMainWindow(process.argv.includes('--hidden') && startupSettings.startToTray)
  if (shouldRestorePreferredWindow) {
    shouldRestorePreferredWindow = false
    focusPreferredWindow()
  }

  const requestQuit = (): void => {
    const snapshot = timer.getSnapshot()
    if (snapshot.status === 'running') {
      const messageBoxOptions: MessageBoxSyncOptions = {
        type: 'question',
        buttons: ['保持 FocusFlow 运行', '仍然退出'],
        defaultId: 0,
        cancelId: 0,
        title: 'FocusFlow 仍在计时',
        message: '当前仍有计时正在进行，确认退出 FocusFlow 吗？'
      }
      const dialogParent = miniWindow && !miniWindow.isDestroyed() ? miniWindow : mainWindow
      const choice = dialogParent
        ? dialog.showMessageBoxSync(dialogParent, messageBoxOptions)
        : dialog.showMessageBoxSync(messageBoxOptions)
      if (choice === 0) return
    }

    isQuitting = true
    void saveMiniWindowPosition()
      .catch((error) => log.error(error))
      .finally(() => {
        miniWindow?.destroy()
        app.quit()
      })
  }

  const buildTrayMenu = () =>
    Menu.buildFromTemplate(
      buildTrayMenuTemplate({
        showMainWindow: () => {
          void showMainWindow().catch((error) => log.error(error))
        },
        showMiniWindow: () => {
          void showMiniWindow().catch((error) => log.error(error))
        },
        startFocus: () => {
          void timer.start({ phase: 'focus' }).catch((error) => log.error(error))
        },
        pauseTimer: () => {
          void timer.pause().catch((error) => log.error(error))
        },
        skipPhase: () => {
          void timer.skip().catch((error) => log.error(error))
        },
        quit: requestQuit
      })
    )

  registerIpcHandlers({
    timer,
    tasks,
    taskDeletion,
    taskBoard,
    settings,
    stats,
    theme,
    showMainWindow,
    showMiniWindow,
    getWindows,
    quit: requestQuit,
    onSettingsUpdated: (updated) => {
      applyNativeThemePreference(updated.themePreference)
      if (!tray) return
      tray.setImage(createTrayImage(nativeTheme.shouldUseDarkColors))
      tray.setContextMenu(buildTrayMenu())
    }
  })

  tray = new Tray(createTrayImage(nativeTheme.shouldUseDarkColors))
  tray.setToolTip('FocusFlow')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => {
    void showMainWindow().catch((error) => log.error(error))
  })
  nativeTheme.on('updated', () => {
    if (!tray) return
    tray.setImage(createTrayImage(nativeTheme.shouldUseDarkColors))
    tray.setContextMenu(buildTrayMenu())
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) return

    event.preventDefault()
    settings
      .get()
      .then((value) => {
        if (value.closeToTray) {
          mainWindow?.hide()
          return
        }

        isQuitting = true
        mainWindow?.close()
      })
      .catch((error) => log.error(error))
  })

  setInterval(() => {
    void runTimerTick()
  }, 1_000)

  app.on('activate', () => {
    void showMainWindow().catch((error) => log.error(error))
  })
  app.on('before-quit', () => {
    unsubscribeTimerSnapshotBroadcast()
  })
  })
}

app.on('before-quit', () => {
  isQuitting = true
})
