import { describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS, type StartTimerRequest, type UpdateTaskRequest } from '@shared/contracts'
import { dispatchRpc, type RpcServices } from './rpc'

const createMockServices = () => {
  const timer = {
    getSnapshot: vi.fn(),
    start: vi.fn(),
    bindCurrentTask: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    skip: vi.fn(),
    reset: vi.fn(),
    applySettings: vi.fn()
  }
  const tasks = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    complete: vi.fn(),
    restore: vi.fn(),
    reorder: vi.fn()
  }
  const taskBoard = { get: vi.fn() }
  const taskDeletion = { delete: vi.fn() }
  const settings = { get: vi.fn(), update: vi.fn() }
  const stats = { get: vi.fn(), getMonth: vi.fn() }

  return { timer, tasks, taskBoard, taskDeletion, settings, stats }
}

const dispatch = (services: ReturnType<typeof createMockServices>, channel: string, payload?: unknown) =>
  dispatchRpc(services as unknown as RpcServices, { channel, payload })

describe('dispatchRpc', () => {
  it('rejects a non-object request', async () => {
    const services = createMockServices()
    await expect(dispatchRpc(services as unknown as RpcServices, 'oops' as never)).rejects.toThrow(
      'rpc request must be an object'
    )
  })

  it('throws on an unknown channel', async () => {
    const services = createMockServices()
    await expect(dispatch(services, 'nope')).rejects.toThrow('Unknown IPC channel: nope')
  })

  it('returns the timer snapshot from getSnapshot', async () => {
    const services = createMockServices()
    const snapshot = { status: 'idle' }
    services.timer.getSnapshot.mockResolvedValue(snapshot)
    await expect(dispatch(services, IPC_CHANNELS.timer.getSnapshot)).resolves.toBe(snapshot)
    expect(services.timer.getSnapshot).toHaveBeenCalledTimes(1)
  })

  it('forwards a validated start command', async () => {
    const services = createMockServices()
    const payload: StartTimerRequest = { phase: 'focus', taskId: 't1' }
    services.timer.start.mockResolvedValue({ status: 'running' })
    await dispatch(services, IPC_CHANNELS.timer.start, payload)
    expect(services.timer.start).toHaveBeenCalledWith(payload)
  })

  it('forwards a bound task id', async () => {
    const services = createMockServices()
    services.timer.bindCurrentTask.mockResolvedValue({ status: 'running', taskId: 't1' })
    await dispatch(services, IPC_CHANNELS.timer.bindCurrentTask, 't1')
    expect(services.timer.bindCurrentTask).toHaveBeenCalledWith('t1')
  })

  it('creates a task from a validated title', async () => {
    const services = createMockServices()
    services.tasks.create.mockResolvedValue({ id: 'x', title: 'hello' })
    await dispatch(services, IPC_CHANNELS.tasks.create, { title: 'hello' })
    expect(services.tasks.create).toHaveBeenCalledWith('hello')
  })

  it('updates a task from validated id and title', async () => {
    const services = createMockServices()
    const payload: UpdateTaskRequest = { id: 'x', title: 'new' }
    services.tasks.update.mockResolvedValue({ id: 'x', title: 'new' })
    await dispatch(services, IPC_CHANNELS.tasks.update, payload)
    expect(services.tasks.update).toHaveBeenCalledWith('x', 'new')
  })

  it('delegates task deletion to taskDeletion service', async () => {
    const services = createMockServices()
    services.taskDeletion.delete.mockResolvedValue(undefined)
    await dispatch(services, IPC_CHANNELS.tasks.delete, 't1')
    expect(services.taskDeletion.delete).toHaveBeenCalledWith('t1')
  })

  it('applies settings after a settings update', async () => {
    const services = createMockServices()
    const updated = { focusMinutes: 30 }
    services.settings.update.mockResolvedValue(updated)
    await dispatch(services, IPC_CHANNELS.settings.update, { patch: { focusMinutes: 30 } })
    expect(services.settings.update).toHaveBeenCalledWith({ focusMinutes: 30 })
    expect(services.timer.applySettings).toHaveBeenCalledWith(updated)
  })

  it('forwards month stats request', async () => {
    const services = createMockServices()
    const month = { year: 2026, month: 9 }
    services.stats.getMonth.mockResolvedValue({ year: 2026, month: 9 })
    await dispatch(services, IPC_CHANNELS.stats.getMonth, month)
    expect(services.stats.getMonth).toHaveBeenCalledWith(month)
  })
})


describe('dispatchRpc - remaining channels', () => {
  it('forwards timer pause/resume/skip/reset', async () => {
    const services = createMockServices()
    services.timer.pause.mockResolvedValue({ status: 'paused' })
    services.timer.resume.mockResolvedValue({ status: 'running' })
    services.timer.skip.mockResolvedValue({ status: 'running', phase: 'shortBreak' })
    services.timer.reset.mockResolvedValue({ status: 'idle' })
    await dispatch(services, IPC_CHANNELS.timer.pause)
    await dispatch(services, IPC_CHANNELS.timer.resume)
    await dispatch(services, IPC_CHANNELS.timer.skip)
    await dispatch(services, IPC_CHANNELS.timer.reset)
    expect(services.timer.pause).toHaveBeenCalledTimes(1)
    expect(services.timer.resume).toHaveBeenCalledTimes(1)
    expect(services.timer.skip).toHaveBeenCalledTimes(1)
    expect(services.timer.reset).toHaveBeenCalledTimes(1)
  })

  it('returns the task board and task list', async () => {
    const services = createMockServices()
    const board = { counts: { all: 0, active: 0, completed: 0 }, activeItems: [], completedItems: [] }
    services.taskBoard.get.mockResolvedValue(board)
    services.tasks.list.mockResolvedValue([])
    await expect(dispatch(services, IPC_CHANNELS.tasks.getBoard)).resolves.toBe(board)
    await expect(dispatch(services, IPC_CHANNELS.tasks.list)).resolves.toEqual([])
  })

  it('forwards complete, restore, reorder', async () => {
    const services = createMockServices()
    services.tasks.complete.mockResolvedValue({ id: 't1', title: 'x', completedAt: 'now' })
    services.tasks.restore.mockResolvedValue({ id: 't1', title: 'x', completedAt: null })
    services.tasks.reorder.mockResolvedValue(undefined)
    await dispatch(services, IPC_CHANNELS.tasks.complete, 't1')
    await dispatch(services, IPC_CHANNELS.tasks.restore, 't1')
    await dispatch(services, IPC_CHANNELS.tasks.reorder, { ids: ['t1', 't2'] })
    expect(services.tasks.complete).toHaveBeenCalledWith('t1')
    expect(services.tasks.restore).toHaveBeenCalledWith('t1')
    expect(services.tasks.reorder).toHaveBeenCalledWith(['t1', 't2'])
  })

  it('forwards settings.get and stats.get', async () => {
    const services = createMockServices()
    const settings = { focusMinutes: 25 }
    const stats = { today: { focusMinutes: 0 } }
    services.settings.get.mockResolvedValue(settings)
    services.stats.get.mockResolvedValue(stats)
    await expect(dispatch(services, IPC_CHANNELS.settings.get)).resolves.toBe(settings)
    await expect(dispatch(services, IPC_CHANNELS.stats.get)).resolves.toBe(stats)
  })
})
