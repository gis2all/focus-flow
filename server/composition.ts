import { createSqliteAppDatabase } from '@main/adapters/sqlite/sqliteDatabase'
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
import { ServerClock } from './clock'
import { NoopAutoLaunchPort, NoopNotificationPort, NoopSoundPort } from './noopPorts'
import type { RpcServices } from './rpc'

export interface ServerComposition {
  services: RpcServices
  timer: TimerService
  dispose: () => void
}

export const createServerComposition = async (dbPath: string): Promise<ServerComposition> => {
  const clock = new ServerClock()
  const database = await createSqliteAppDatabase(dbPath)

  const taskRepository = new SqliteTaskRepository(database)
  const sessionRepository = new SqliteTimerSessionRepository(database)
  const runtimeRepository = new SqliteTimerRuntimeRepository(database)
  const settingsRepository = new SqliteSettingsRepository(database)
  const eventRepository = new SqliteAppEventRepository(database)

  const settings = new SettingsService(settingsRepository, new NoopAutoLaunchPort())
  const tasks = new TaskService(taskRepository)
  const taskBoard = new TaskBoardService(taskRepository, sessionRepository)
  const stats = new StatsService(sessionRepository, taskRepository, clock)

  const timer = new TimerService({
    sessions: sessionRepository,
    settings,
    runtime: runtimeRepository,
    events: eventRepository,
    tasks: taskRepository,
    clock,
    notifier: new NoopNotificationPort(),
    sound: new NoopSoundPort()
  })

  const taskDeletion = new TaskDeletionService({
    tasks: taskRepository,
    sessions: sessionRepository,
    timer,
    transactions: database
  })

  await timer.initialize()

  const services: RpcServices = { timer, tasks, taskBoard, taskDeletion, settings, stats }

  return {
    services,
    timer,
    dispose: () => database.close()
  }
}
