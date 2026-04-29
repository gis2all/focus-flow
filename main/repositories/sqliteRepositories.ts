import { randomUUID } from 'node:crypto'
import { defaultSettings } from '@shared/defaults'
import type { AppEvent, AppSettings, CompletionReason, Task, TimerPhase, TimerSession, TimerState } from '@shared/types'
import type {
  AppEventRepository,
  CreateTimerSessionInput,
  FinishTimerSessionInput,
  SettingsRepository,
  TaskRepository,
  UpdateTimerSessionTaskInput,
  TimerRuntimeRepository,
  TimerSessionRepository
} from '@main/ports/repositories'
import type { SqliteAppDatabase } from '@main/adapters/sqlite/sqliteDatabase'

interface TaskRow extends Record<string, unknown> {
  id: string
  title: string
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

interface TimerSessionRow extends Record<string, unknown> {
  id: string
  phase: TimerPhase
  task_id: string | null
  started_at: string
  ended_at: string | null
  duration_ms: number
  actual_duration_ms: number | null
  completed: number
  completion_reason: CompletionReason | null
  created_at: string
  updated_at: string
}

interface SettingRow extends Record<string, unknown> {
  key: string
  value: string
}

interface AppEventRow extends Record<string, unknown> {
  id: string
  type: string
  payload: string
  created_at: string
}

interface TimerRuntimeRow extends Record<string, unknown> {
  slot: string
  state_json: string
  updated_at: string
}

const nowIso = (): string => new Date().toISOString()
const appSettingKeys = Object.keys(defaultSettings) as Array<keyof AppSettings>

const mapTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  sortOrder: Number(row.sort_order),
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const mapTimerSession = (row: TimerSessionRow): TimerSession => ({
  id: row.id,
  phase: row.phase,
  taskId: row.task_id,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  durationMs: Number(row.duration_ms),
  actualDurationMs: row.actual_duration_ms === null ? null : Number(row.actual_duration_ms),
  completed: Number(row.completed) === 1,
  completionReason: row.completion_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const mapAppEvent = (row: AppEventRow): AppEvent => ({
  id: row.id,
  type: row.type,
  payload: JSON.parse(row.payload) as Record<string, unknown>,
  createdAt: row.created_at
})

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly database: SqliteAppDatabase) {}

  async list(): Promise<Task[]> {
    return this.database
      .all<TaskRow>(
        `SELECT *
         FROM tasks
         ORDER BY
           CASE WHEN completed_at IS NULL THEN 0 ELSE 1 END ASC,
           CASE WHEN completed_at IS NULL THEN sort_order ELSE 0 END ASC,
           completed_at DESC,
           created_at ASC`
      )
      .map(mapTask)
  }

  async create(title: string, now = nowIso()): Promise<Task> {
    const id = randomUUID()
    const sortOrder = await this.getNextSortOrder()
    await this.database.run(
      'INSERT INTO tasks (id, title, sort_order, completed_at, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      [id, title, sortOrder, now, now]
    )
    return this.getRequired(id)
  }

  async updateTitle(id: string, title: string, now = nowIso()): Promise<Task> {
    await this.database.run('UPDATE tasks SET title = ?, updated_at = ? WHERE id = ?', [title, now, id])
    return this.getRequired(id)
  }

  async complete(id: string, now = nowIso()): Promise<Task> {
    await this.database.run('UPDATE tasks SET completed_at = ?, sort_order = 0, updated_at = ? WHERE id = ?', [now, now, id])
    return this.getRequired(id)
  }

  async restore(id: string, now = nowIso()): Promise<Task> {
    const sortOrder = await this.getNextSortOrder()
    await this.database.run('UPDATE tasks SET completed_at = NULL, sort_order = ?, updated_at = ? WHERE id = ?', [
      sortOrder,
      now,
      id
    ])
    return this.getRequired(id)
  }

  async reorderActive(ids: string[], now = nowIso()): Promise<void> {
    const activeRows = this.database.all<{ id: string }>(
      'SELECT id FROM tasks WHERE completed_at IS NULL ORDER BY sort_order ASC, created_at ASC'
    )
    const activeIds = activeRows.map((row) => row.id)
    if (activeIds.length !== ids.length) {
      throw new Error('Task reorder payload must include every active task')
    }

    const expected = [...activeIds].sort()
    const received = [...ids].sort()
    for (let index = 0; index < expected.length; index += 1) {
      if (expected[index] !== received[index]) {
        throw new Error('Task reorder payload does not match active tasks')
      }
    }

    for (let index = 0; index < ids.length; index += 1) {
      await this.database.run('UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?', [index + 1, now, ids[index]])
    }
  }

  async delete(id: string): Promise<void> {
    const changedRows = await this.database.run('DELETE FROM tasks WHERE id = ?', [id])
    if (changedRows === 0) {
      throw new Error(`Task not found: ${id}`)
    }
  }

  private async getRequired(id: string): Promise<Task> {
    const row = this.database.get<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id])
    if (!row) throw new Error(`Task not found: ${id}`)
    return mapTask(row)
  }

  private async getNextSortOrder(): Promise<number> {
    const row = this.database.get<{ max_sort_order: number | null }>(
      'SELECT MAX(sort_order) AS max_sort_order FROM tasks WHERE completed_at IS NULL'
    )
    return Number(row?.max_sort_order ?? 0) + 1
  }
}

export class SqliteTimerSessionRepository implements TimerSessionRepository {
  constructor(private readonly database: SqliteAppDatabase) {}

  async list(): Promise<TimerSession[]> {
    return this.database.all<TimerSessionRow>('SELECT * FROM timer_sessions ORDER BY started_at ASC').map(mapTimerSession)
  }

  async create(input: CreateTimerSessionInput): Promise<TimerSession> {
    const id = randomUUID()
    await this.database.run(
      `INSERT INTO timer_sessions
       (id, phase, task_id, started_at, ended_at, duration_ms, actual_duration_ms, completed, completion_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, NULL, 0, NULL, ?, ?)`,
      [id, input.phase, input.taskId, input.startedAt, input.durationMs, input.startedAt, input.startedAt]
    )
    return this.getRequired(id)
  }

  async finish(input: FinishTimerSessionInput): Promise<void> {
    const changedRows = await this.database.run(
      `UPDATE timer_sessions
       SET ended_at = ?, actual_duration_ms = ?, completed = ?, completion_reason = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.endedAt,
        input.actualDurationMs,
        input.completed ? 1 : 0,
        input.completionReason,
        input.endedAt,
        input.id
      ]
    )
    if (changedRows === 0) {
      throw new Error(`Timer session not found: ${input.id}`)
    }
  }

  async updateTask(input: UpdateTimerSessionTaskInput): Promise<void> {
    const changedRows = await this.database.run(
      `UPDATE timer_sessions
       SET task_id = ?, updated_at = ?
       WHERE id = ?`,
      [input.taskId, input.updatedAt, input.id]
    )
    if (changedRows === 0) {
      throw new Error(`Timer session not found: ${input.id}`)
    }
  }

  async deleteHistoricalFocusByTaskId(taskId: string): Promise<void> {
    await this.database.run(
      `DELETE FROM timer_sessions
       WHERE phase = 'focus' AND task_id = ?`,
      [taskId]
    )
  }

  async findActive(): Promise<TimerSession | null> {
    const row = this.database.get<TimerSessionRow>(
      'SELECT * FROM timer_sessions WHERE ended_at IS NULL AND completed = 0 ORDER BY started_at DESC LIMIT 1'
    )
    return row ? mapTimerSession(row) : null
  }

  private async getRequired(id: string): Promise<TimerSession> {
    const row = this.database.get<TimerSessionRow>('SELECT * FROM timer_sessions WHERE id = ?', [id])
    if (!row) throw new Error(`Timer session not found: ${id}`)
    return mapTimerSession(row)
  }
}

export class SqliteSettingsRepository implements SettingsRepository {
  constructor(private readonly database: SqliteAppDatabase) {}

  async get(): Promise<AppSettings> {
    const rows = this.database.all<SettingRow>(
      `SELECT key, value
       FROM settings
       WHERE key IN (${appSettingKeys.map(() => '?').join(', ')})`,
      appSettingKeys
    )
    const saved = rows.reduce<Partial<AppSettings>>((settings, row) => {
      return {
        ...settings,
        [row.key as keyof AppSettings]: JSON.parse(row.value)
      }
    }, {})

    return {
      ...defaultSettings,
      ...saved
    }
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const now = nowIso()
    for (const [key, value] of Object.entries(patch)) {
      await this.database.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [
        key,
        JSON.stringify(value),
        now
      ])
    }
    return this.get()
  }
}

export class SqliteTimerRuntimeRepository implements TimerRuntimeRepository {
  constructor(private readonly database: SqliteAppDatabase) {}

  async get(): Promise<TimerState | null> {
    const row = this.database.get<TimerRuntimeRow>('SELECT * FROM timer_runtime WHERE slot = ?', ['main'])
    if (!row) return null
    return JSON.parse(row.state_json) as TimerState
  }

  async save(state: TimerState): Promise<void> {
    await this.database.run(
      'INSERT OR REPLACE INTO timer_runtime (slot, state_json, updated_at) VALUES (?, ?, ?)',
      ['main', JSON.stringify(state), nowIso()]
    )
  }
}

export class SqliteAppEventRepository implements AppEventRepository {
  constructor(private readonly database: SqliteAppDatabase) {}

  async record(type: string, payload: Record<string, unknown>, now = nowIso()): Promise<AppEvent> {
    const id = randomUUID()
    await this.database.run('INSERT INTO app_events (id, type, payload, created_at) VALUES (?, ?, ?, ?)', [
      id,
      type,
      JSON.stringify(payload),
      now
    ])
    const row = this.database.get<AppEventRow>('SELECT * FROM app_events WHERE id = ?', [id])
    if (!row) throw new Error(`App event not found: ${id}`)
    return mapAppEvent(row)
  }

  async list(): Promise<AppEvent[]> {
    return this.database.all<AppEventRow>('SELECT * FROM app_events ORDER BY created_at ASC').map(mapAppEvent)
  }
}
