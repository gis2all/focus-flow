import { MINI_WINDOW_HEIGHT, MINI_WINDOW_WIDTH } from '@shared/windowMetrics'

export { MINI_WINDOW_HEIGHT, MINI_WINDOW_WIDTH }
export const MINI_WINDOW_PADDING = 24

interface Point {
  x: number
  y: number
}

interface WorkArea extends Point {
  width: number
  height: number
}

interface DisplayLike {
  workArea: WorkArea
}

interface ResolveMiniWindowPositionOptions {
  savedPosition: Point | null
  displays: DisplayLike[]
}

interface MainWindowLike {
  isMinimized(): boolean
  restore(): void
  show(): void
  focus(): void
}

interface MiniWindowLike {
  hide(): void
}

interface MainWindowHideLike {
  hide(): void
}

interface MiniWindowShowLike {
  show(): void
  focus(): void
}

interface MiniWindowChromeOptions {
  width: number
  height: number
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
  x: number
  y: number
  show: false
  frame: false
  transparent: true
  thickFrame: false
  resizable: false
  minimizable: false
  maximizable: false
  fullscreenable: false
  alwaysOnTop: true
  skipTaskbar: true
  autoHideMenuBar: true
  backgroundColor: '#00000000'
}

const resolveDefaultPosition = ({ x, y, width, height }: WorkArea): Point => ({
  x: x + width - MINI_WINDOW_WIDTH - MINI_WINDOW_PADDING,
  y: y + height - MINI_WINDOW_HEIGHT - MINI_WINDOW_PADDING
})

const positionFitsWorkArea = (position: Point, workArea: WorkArea): boolean =>
  position.x >= workArea.x &&
  position.y >= workArea.y &&
  position.x + MINI_WINDOW_WIDTH <= workArea.x + workArea.width &&
  position.y + MINI_WINDOW_HEIGHT <= workArea.y + workArea.height

export const resolveMiniWindowPosition = ({
  savedPosition,
  displays
}: ResolveMiniWindowPositionOptions): Point => {
  const [primaryDisplay] = displays
  if (!primaryDisplay) {
    return {
      x: MINI_WINDOW_PADDING,
      y: MINI_WINDOW_PADDING
    }
  }

  if (savedPosition && displays.some((display) => positionFitsWorkArea(savedPosition, display.workArea))) {
    return savedPosition
  }

  return resolveDefaultPosition(primaryDisplay.workArea)
}

export const createMiniWindowChromeOptions = (position: Point): MiniWindowChromeOptions => ({
  width: MINI_WINDOW_WIDTH,
  height: MINI_WINDOW_HEIGHT,
  minWidth: MINI_WINDOW_WIDTH,
  minHeight: MINI_WINDOW_HEIGHT,
  maxWidth: MINI_WINDOW_WIDTH,
  maxHeight: MINI_WINDOW_HEIGHT,
  x: position.x,
  y: position.y,
  show: false,
  frame: false,
  transparent: true,
  thickFrame: false,
  resizable: false,
  minimizable: false,
  maximizable: false,
  fullscreenable: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  autoHideMenuBar: true,
  backgroundColor: '#00000000'
})

export const activateMainWindow = (mainWindow: MainWindowLike, miniWindow?: MiniWindowLike | null): void => {
  miniWindow?.hide()
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

export const activateMiniWindow = (mainWindow: MainWindowHideLike | null, miniWindow: MiniWindowShowLike): void => {
  mainWindow?.hide()
  miniWindow.show()
  miniWindow.focus()
}
