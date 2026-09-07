import { IPC_CHANNELS } from '@shared/contracts'
import {
  getCreateTaskRequest,
  getMonthStatsRequest,
  getOptionalTaskId,
  getReorderTasksRequest,
  getStartTimerRequest,
  getTaskId,
  getUpdateTaskRequest
} from '@main/ipc/requestValidation'
import { getSettingsUpdatePatch } from '@main/ipc/settingsUpdateRequest'
import type { SettingsService } from '@main/services/settingsService'
import type { StatsService } from '@main/services/statsService'
import type { TaskBoardService } from '@main/services/taskBoardService'
import type { TaskDeletionService } from '@main/services/taskDeletionService'
import type { TaskService } from '@main/services/taskService'
import type { TimerService } from '@main/services/timerService'

// The subset of services the web RPC endpoint needs. system.* channels are
// handled entirely on the client (window controls, theme, drag), so they are
// deliberately absent here.
export interface RpcServices {
  timer: Pick<
    TimerService,
    'getSnapshot' | 'start' | 'bindCurrentTask' | 'pause' | 'resume' | 'skip' | 'reset' | 'applySettings'
  >
  tasks: Pick<TaskService, 'list' | 'create' | 'update' | 'complete' | 'restore' | 'reorder'>
  taskBoard: Pick<TaskBoardService, 'get'>
  taskDeletion: Pick<TaskDeletionService, 'delete'>
  settings: Pick<SettingsService, 'get' | 'update'>
  stats: Pick<StatsService, 'get' | 'getMonth'>
}

export interface RpcRequest {
  channel: string
  payload?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const dispatchRpc = async (services: RpcServices, request: RpcRequest): Promise<unknown> => {
  if (!isRecord(request)) {
    throw new Error('rpc request must be an object')
  }

  const { channel, payload } = request

  switch (channel) {
    case IPC_CHANNELS.timer.getSnapshot:
      return services.timer.getSnapshot()
    case IPC_CHANNELS.timer.start:
      return services.timer.start(getStartTimerRequest(payload))
    case IPC_CHANNELS.timer.bindCurrentTask:
      return services.timer.bindCurrentTask(getOptionalTaskId(payload, 'timer.bindCurrentTask'))
    case IPC_CHANNELS.timer.pause:
      return services.timer.pause()
    case IPC_CHANNELS.timer.resume:
      return services.timer.resume()
    case IPC_CHANNELS.timer.skip:
      return services.timer.skip()
    case IPC_CHANNELS.timer.reset:
      return services.timer.reset()

    case IPC_CHANNELS.tasks.getBoard:
      return services.taskBoard.get()
    case IPC_CHANNELS.tasks.list:
      return services.tasks.list()
    case IPC_CHANNELS.tasks.create:
      return services.tasks.create(getCreateTaskRequest(payload).title)
    case IPC_CHANNELS.tasks.update: {
      const validated = getUpdateTaskRequest(payload)
      return services.tasks.update(validated.id, validated.title)
    }
    case IPC_CHANNELS.tasks.complete:
      return services.tasks.complete(getTaskId(payload, 'tasks.complete'))
    case IPC_CHANNELS.tasks.restore:
      return services.tasks.restore(getTaskId(payload, 'tasks.restore'))
    case IPC_CHANNELS.tasks.reorder:
      return services.tasks.reorder(getReorderTasksRequest(payload).ids)
    case IPC_CHANNELS.tasks.delete:
      return services.taskDeletion.delete(getTaskId(payload, 'tasks.delete'))

    case IPC_CHANNELS.settings.get:
      return services.settings.get()
    case IPC_CHANNELS.settings.update: {
      const updated = await services.settings.update(getSettingsUpdatePatch(payload))
      await services.timer.applySettings(updated)
      return updated
    }

    case IPC_CHANNELS.stats.get:
      return services.stats.get()
    case IPC_CHANNELS.stats.getMonth:
      return services.stats.getMonth(getMonthStatsRequest(payload))

    default:
      throw new Error(`Unknown IPC channel: ${String(channel)}`)
  }
}
