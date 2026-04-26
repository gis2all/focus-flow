import { app, BrowserWindow, dialog, Menu, nativeImage, nativeTheme, Tray, type MessageBoxSyncOptions } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import log from 'electron-log'
import { IPC_CHANNELS } from '@shared/contracts'
import type { AppSettings } from '@shared/types'
import { createSqliteAppDatabase } from '@main/adapters/sqlite/sqliteDatabase'
import {
  ElectronAutoLaunchAdapter,
  ElectronNotificationAdapter,
  ElectronSoundAdapter,
  ElectronSystemThemeAdapter,
  SystemClock
} from '@main/adapters/desktop'
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
import { TaskService } from '@main/services/taskService'
import { TimerService } from '@main/services/timerService'

const __dirname = dirname(fileURLToPath(import.meta.url))
const getAssetPath = (...segments: string[]) => join(app.getAppPath(), ...segments)
const getRuntimeAssetPath = (filename: string) =>
  app.isPackaged ? join(process.resourcesPath, 'app-assets', filename) : getAssetPath('resources', filename)

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

const loadTrayImage = (filename: string) => {
  const image = nativeImage.createFromPath(getRuntimeAssetPath(filename))
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

const createMainWindow = (startHidden: boolean): BrowserWindow => {
  const shouldStartHidden = process.argv.includes('--hidden') || startHidden
  const window = new BrowserWindow({
    width: 888,
    height: 752,
    minWidth: 888,
    minHeight: 752,
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

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

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
  const timer = new TimerService({
    sessions: sessionRepository,
    settings: settingsRepository,
    runtime: runtimeRepository,
    events: eventRepository,
    tasks: taskRepository,
    clock,
    notifier: new ElectronNotificationAdapter(),
    sound: new ElectronSoundAdapter()
  })

  await timer.initialize()

  const startupSettings = await settings.get()
  applyNativeThemePreference(startupSettings.themePreference)
  mainWindow = createMainWindow(process.argv.includes('--hidden') && startupSettings.startToTray)

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
      const choice = mainWindow
        ? dialog.showMessageBoxSync(mainWindow, messageBoxOptions)
        : dialog.showMessageBoxSync(messageBoxOptions)
      if (choice === 0) return
    }
    isQuitting = true
    app.quit()
  }

  const buildTrayMenu = () =>
    Menu.buildFromTemplate([
      { label: '显示主窗口', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: '开始专注', click: () => void timer.start({ phase: 'focus' }).catch((error) => log.error(error)) },
      { label: '暂停计时', click: () => void timer.pause().catch((error) => log.error(error)) },
      { label: '跳过当前阶段', click: () => void timer.skip().catch((error) => log.error(error)) },
      { type: 'separator' },
      { label: '退出', click: requestQuit }
    ])

  registerIpcHandlers({
    timer,
    tasks,
    taskBoard,
    settings,
    stats,
    theme,
    getWindow: () => mainWindow,
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
  tray.on('click', () => mainWindow?.show())
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
    timer
      .tick()
      .then((snapshot) => mainWindow?.webContents.send(IPC_CHANNELS.timer.snapshot, snapshot))
      .catch((error) => log.error(error))
  }, 1_000)
})

app.on('activate', () => {
  mainWindow?.show()
})

app.on('before-quit', () => {
  isQuitting = true
})
