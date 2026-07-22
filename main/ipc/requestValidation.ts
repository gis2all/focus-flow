import type {
  CreateTaskRequest,
  MonthStatsRequest,
  ReorderTasksRequest,
  ResizeWindowRequest,
  StartTimerRequest,
  UpdateTaskRequest,
  WindowDragRequest
} from '@shared/contracts'
import { isPlainObject } from '@shared/settingsValidation'

const requireObject = (value: unknown, channel: string): Record<string, unknown> => {
  if (!isPlainObject(value)) {
    throw new Error(`${channel} request must be an object`)
  }
  return value
}

const requireNonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

const requireString = (value: unknown, label: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`)
  }
  return value
}

export const getOptionalTaskId = (value: unknown, channel: string): string | null => {
  if (value === null) return null
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${channel} taskId must be a non-empty string or null`)
  }
  return value
}

export const getTaskId = (value: unknown, channel: string): string =>
  requireNonEmptyString(value, `${channel} id`)

export const getStartTimerRequest = (value: unknown): StartTimerRequest => {
  if (value === undefined) return {}
  const request = requireObject(value, 'timer.start')
  const result: StartTimerRequest = {}

  if (Object.prototype.hasOwnProperty.call(request, 'phase')) {
    if (request.phase !== 'focus' && request.phase !== 'shortBreak' && request.phase !== 'longBreak') {
      throw new Error('timer.start phase is invalid')
    }
    result.phase = request.phase
  }

  if (Object.prototype.hasOwnProperty.call(request, 'taskId')) {
    if (request.taskId !== null && typeof request.taskId !== 'string') {
      throw new Error('timer.start taskId must be a string or null')
    }
    result.taskId = request.taskId
  }

  return result
}

export const getCreateTaskRequest = (value: unknown): CreateTaskRequest => {
  const request = requireObject(value, 'tasks.create')
  return { title: requireString(request.title, 'tasks.create title') }
}

export const getUpdateTaskRequest = (value: unknown): UpdateTaskRequest => {
  const request = requireObject(value, 'tasks.update')
  return {
    id: requireNonEmptyString(request.id, 'tasks.update id'),
    title: requireString(request.title, 'tasks.update title')
  }
}

export const getReorderTasksRequest = (value: unknown): ReorderTasksRequest => {
  const request = requireObject(value, 'tasks.reorder')
  if (!Array.isArray(request.ids) || !request.ids.every((id) => typeof id === 'string')) {
    throw new Error('tasks.reorder ids must contain only strings')
  }
  return { ids: request.ids }
}

export const getMonthStatsRequest = (value: unknown): MonthStatsRequest => {
  const request = requireObject(value, 'stats.getMonth')
  if (!Number.isInteger(request.year)) {
    throw new Error('stats.getMonth year must be an integer')
  }
  if (!Number.isInteger(request.month) || Number(request.month) < 1 || Number(request.month) > 12) {
    throw new Error('stats.getMonth month must be between 1 and 12')
  }
  return { year: Number(request.year), month: Number(request.month) }
}

export const getResizeWindowRequest = (value: unknown): ResizeWindowRequest => {
  const request = requireObject(value, 'system.resizeWindow')
  if (
    typeof request.width !== 'number' ||
    typeof request.height !== 'number' ||
    !Number.isFinite(request.width) ||
    !Number.isFinite(request.height) ||
    request.width <= 0 ||
    request.height <= 0
  ) {
    throw new Error('system.resizeWindow width and height must be finite positive numbers')
  }
  return { width: request.width, height: request.height }
}

export const getWindowDragRequest = (value: unknown): WindowDragRequest => {
  const request = requireObject(value, 'system.windowDrag')
  if (
    typeof request.pointerScreenX !== 'number' ||
    typeof request.pointerScreenY !== 'number' ||
    !Number.isFinite(request.pointerScreenX) ||
    !Number.isFinite(request.pointerScreenY)
  ) {
    throw new Error('system.windowDrag coordinates must be finite numbers')
  }
  return { pointerScreenX: request.pointerScreenX, pointerScreenY: request.pointerScreenY }
}
