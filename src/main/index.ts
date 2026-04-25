import { app, BrowserWindow, dialog, Menu, nativeImage, Tray, type MessageBoxSyncOptions } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import log from 'electron-log'
import { IPC_CHANNELS } from '@shared/contracts'
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

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

const createTrayImage = () => {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">',
    '<rect width="32" height="32" fill="#0f6bff"/>',
    '<circle cx="16" cy="16" r="9" fill="none" stroke="#ffffff" stroke-width="3"/>',
    '<path d="M16 8v8l5 4" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="square"/>',
    '</svg>'
  ].join('')
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
}

const createMainWindow = (startHidden: boolean): BrowserWindow => {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    title: 'FocusFlow',
    autoHideMenuBar: true,
    backgroundColor: '#f4f7fb',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const shouldStartHidden = process.argv.includes('--hidden') || startHidden
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
    clock,
    notifier: new ElectronNotificationAdapter(),
    sound: new ElectronSoundAdapter()
  })

  await timer.initialize()

  const startupSettings = await settings.get()
  mainWindow = createMainWindow(startupSettings.startToTray)

  const requestQuit = (): void => {
    const snapshot = timer.getSnapshot()
    if (snapshot.status === 'running') {
      const messageBoxOptions: MessageBoxSyncOptions = {
        type: 'question',
        buttons: ['Keep FocusFlow Running', 'Quit Anyway'],
        defaultId: 0,
        cancelId: 0,
        title: 'FocusFlow is still timing',
        message: 'A timer is currently running. Quit FocusFlow anyway?'
      }
      const choice = mainWindow
        ? dialog.showMessageBoxSync(mainWindow, messageBoxOptions)
        : dialog.showMessageBoxSync(messageBoxOptions)
      if (choice === 0) return
    }
    isQuitting = true
    app.quit()
  }

  registerIpcHandlers({
    timer,
    tasks,
    taskBoard,
    settings,
    stats,
    theme,
    getWindow: () => mainWindow,
    quit: requestQuit
  })

  tray = new Tray(createTrayImage())
  tray.setToolTip('FocusFlow')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show FocusFlow', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: 'Start Focus', click: () => timer.start({ phase: 'focus' }).catch((error) => log.error(error)) },
      { label: 'Pause Timer', click: () => timer.pause().catch((error) => log.error(error)) },
      { label: 'Skip Phase', click: () => timer.skip().catch((error) => log.error(error)) },
      { type: 'separator' },
      { label: 'Quit', click: requestQuit }
    ])
  )
  tray.on('click', () => mainWindow?.show())

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
