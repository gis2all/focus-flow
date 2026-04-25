import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import { createSqliteAppDatabase, type SqliteAppDatabase } from '@main/adapters/sqlite/sqliteDatabase'
import {
  SqliteAppEventRepository,
  SqliteSettingsRepository,
  SqliteTaskRepository,
  SqliteTimerRuntimeRepository,
  SqliteTimerSessionRepository
} from './sqliteRepositories'

let tempDir: string
let dbFilePath: string
let database: SqliteAppDatabase

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'focusflow-'))
  dbFilePath = join(tempDir, 'focusflow.sqlite')
  database = await createSqliteAppDatabase(dbFilePath)
})

afterEach(async () => {
  database.close()
  await rm(tempDir, { recursive: true, force: true })
})

describe('sqlite repositories', () => {
  test('creates, reorders, completes, restores and deletes tasks', async () => {
    const tasks = new SqliteTaskRepository(database)

    const first = await tasks.create('Write architecture notes', '2026-04-25T09:00:00.000')
    const second = await tasks.create('Review timer flow', '2026-04-25T09:05:00.000')
    const third = await tasks.create('Polish tray menu', '2026-04-25T09:10:00.000')

    expect((await tasks.list()).map((task) => [task.id, task.sortOrder])).toEqual([
      [first.id, 1],
      [second.id, 2],
      [third.id, 3]
    ])

    await tasks.reorderActive([third.id, first.id, second.id], '2026-04-25T09:20:00.000')
    expect((await tasks.list()).map((task) => [task.id, task.sortOrder])).toEqual([
      [third.id, 1],
      [first.id, 2],
      [second.id, 3]
    ])

    const completed = await tasks.complete(first.id, '2026-04-25T10:00:00.000')
    expect(completed.completedAt).toBe('2026-04-25T10:00:00.000')
    expect(completed.sortOrder).toBe(0)

    const restored = await tasks.restore(first.id, '2026-04-25T10:05:00.000')
    expect(restored.completedAt).toBeNull()
    expect(restored.sortOrder).toBe(4)

    await tasks.delete(second.id)

    expect((await tasks.list()).map((task) => task.id)).toEqual([third.id, first.id])
  })

  test('backfills active task sort order when existing rows have zero sort order', async () => {
    const tasks = new SqliteTaskRepository(database)

    const first = await tasks.create('Task A', '2026-04-25T09:00:00.000')
    const second = await tasks.create('Task B', '2026-04-25T09:05:00.000')
    await database.run('UPDATE tasks SET sort_order = 0 WHERE completed_at IS NULL')

    database.close()
    database = await createSqliteAppDatabase(dbFilePath)

    const reopenedTasks = new SqliteTaskRepository(database)
    expect((await reopenedTasks.list()).map((task) => [task.id, task.sortOrder])).toEqual([
      [first.id, 1],
      [second.id, 2]
    ])
  })

  test('creates active timer sessions and finishes them', async () => {
    const sessions = new SqliteTimerSessionRepository(database)

    const created = await sessions.create({
      phase: 'focus',
      taskId: 'task-1',
      startedAt: '2026-04-25T09:00:00.000',
      durationMs: 25 * 60_000
    })

    expect(await sessions.findActive()).toMatchObject({ id: created.id, taskId: 'task-1' })

    await sessions.finish({
      id: created.id,
      endedAt: '2026-04-25T09:25:00.000',
      actualDurationMs: 25 * 60_000,
      completed: true,
      completionReason: 'completed'
    })

    expect(await sessions.findActive()).toBeNull()
    expect(await sessions.list()).toHaveLength(1)
  })

  test('persists settings as merged application settings', async () => {
    const settings = new SqliteSettingsRepository(database)

    expect(await settings.get()).toEqual(defaultSettings)

    await settings.update({ focusMinutes: 50, themePreference: 'dark' })

    expect(await settings.get()).toEqual({
      ...defaultSettings,
      focusMinutes: 50,
      themePreference: 'dark'
    })
  })

  test('persists timer runtime state for restore scenarios', async () => {
    const runtime = new SqliteTimerRuntimeRepository(database)

    await runtime.save({
      status: 'paused',
      phase: 'focus',
      taskId: 'task-1',
      startedAt: null,
      targetEndAt: null,
      durationMs: 25 * 60_000,
      remainingMs: 11 * 60_000,
      focusCount: 3,
      sessionId: 'session-1',
      updatedAt: new Date('2026-04-25T09:14:00.000Z').getTime()
    })

    await expect(runtime.get()).resolves.toEqual(
      expect.objectContaining({
        status: 'paused',
        remainingMs: 11 * 60_000,
        focusCount: 3
      })
    )
  })

  test('records app events for diagnostics', async () => {
    const events = new SqliteAppEventRepository(database)

    await events.record('timer.restore', { sessionId: 'session-1', action: 'resume' }, '2026-04-25T09:00:00.000')

    expect(await events.list()).toEqual([
      expect.objectContaining({
        type: 'timer.restore',
        payload: { sessionId: 'session-1', action: 'resume' }
      })
    ])
  })
})
