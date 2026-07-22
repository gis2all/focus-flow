import { describe, expect, test } from 'vitest'
import {
  getCreateTaskRequest,
  getMonthStatsRequest,
  getReorderTasksRequest,
  getResizeWindowRequest,
  getStartTimerRequest,
  getTaskId,
  getUpdateTaskRequest,
  getWindowDragRequest,
  getOptionalTaskId
} from './requestValidation'

describe('IPC request validation', () => {
  test('accepts valid timer requests and optional task bindings', () => {
    expect(getStartTimerRequest(undefined)).toEqual({})
    expect(getStartTimerRequest({ phase: 'focus', taskId: 'task-1' })).toEqual({ phase: 'focus', taskId: 'task-1' })
    expect(getOptionalTaskId(null, 'timer.bindCurrentTask')).toBeNull()
  })

  test('rejects malformed timer requests', () => {
    expect(() => getStartTimerRequest([])).toThrow('timer.start request must be an object')
    expect(() => getStartTimerRequest({ phase: 'invalid' })).toThrow('timer.start phase is invalid')
    expect(() => getStartTimerRequest({ taskId: 42 })).toThrow('timer.start taskId must be a string or null')
    expect(() => getOptionalTaskId('', 'timer.bindCurrentTask')).toThrow(
      'timer.bindCurrentTask taskId must be a non-empty string or null'
    )
  })

  test('accepts valid task requests', () => {
    expect(getCreateTaskRequest({ title: 'Write notes' })).toEqual({ title: 'Write notes' })
    expect(getUpdateTaskRequest({ id: 'task-1', title: 'Review notes' })).toEqual({
      id: 'task-1',
      title: 'Review notes'
    })
    expect(getReorderTasksRequest({ ids: ['task-2', 'task-1'] })).toEqual({ ids: ['task-2', 'task-1'] })
    expect(getTaskId('task-1', 'tasks.complete')).toBe('task-1')
  })

  test('rejects malformed task requests', () => {
    expect(() => getCreateTaskRequest({ title: 42 })).toThrow('tasks.create title must be a string')
    expect(() => getUpdateTaskRequest({ id: '', title: 'Title' })).toThrow('tasks.update id must be a non-empty string')
    expect(() => getReorderTasksRequest({ ids: ['task-1', 2] })).toThrow('tasks.reorder ids must contain only strings')
    expect(() => getTaskId(null, 'tasks.delete')).toThrow('tasks.delete id must be a non-empty string')
  })

  test('validates statistics and window geometry requests', () => {
    expect(getMonthStatsRequest({ year: 2026, month: 7 })).toEqual({ year: 2026, month: 7 })
    expect(getResizeWindowRequest({ width: 420.4, height: 180.6 })).toEqual({ width: 420.4, height: 180.6 })
    expect(getWindowDragRequest({ pointerScreenX: -20, pointerScreenY: 300 })).toEqual({
      pointerScreenX: -20,
      pointerScreenY: 300
    })
  })

  test('rejects invalid statistics and window geometry requests', () => {
    expect(() => getMonthStatsRequest({ year: 2026, month: 13 })).toThrow('stats.getMonth month must be between 1 and 12')
    expect(() => getMonthStatsRequest({ year: 2026.5, month: 7 })).toThrow('stats.getMonth year must be an integer')
    expect(() => getResizeWindowRequest({ width: Infinity, height: 180 })).toThrow(
      'system.resizeWindow width and height must be finite positive numbers'
    )
    expect(() => getWindowDragRequest({ pointerScreenX: 20, pointerScreenY: Number.NaN })).toThrow(
      'system.windowDrag coordinates must be finite numbers'
    )
  })
})
