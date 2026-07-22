import { copyFile, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  createSqliteAppDatabase,
  type SqliteAppDatabase
} from './sqliteDatabase'

let database: SqliteAppDatabase | null
let databasePath: string
let tempDirectory: string

beforeEach(async () => {
  tempDirectory = await mkdtemp(join(tmpdir(), 'focusflow-database-'))
  databasePath = join(tempDirectory, 'focusflow.sqlite')
  database = await createSqliteAppDatabase(databasePath)
})

afterEach(async () => {
  database?.close()
  database = null
  await rm(tempDirectory, { recursive: true, force: true })
})

describe('sqlite database durability', () => {
  test('records the current schema version', () => {
    expect(database?.get<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(CURRENT_SCHEMA_VERSION)
  })

  test('rolls back a failed transaction in memory and on disk', async () => {
    await expect(
      database?.transaction(async () => {
        await database?.run(
          'INSERT INTO tasks (id, title, sort_order, completed_at, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
          ['rolled-back-task', 'Rolled back', 1, '2026-07-22T09:00:00.000Z', '2026-07-22T09:00:00.000Z']
        )
        throw new Error('stop transaction')
      })
    ).rejects.toThrow('stop transaction')

    expect(database?.get('SELECT id FROM tasks WHERE id = ?', ['rolled-back-task'])).toBeNull()

    database?.close()
    database = await createSqliteAppDatabase(databasePath)
    expect(database.get('SELECT id FROM tasks WHERE id = ?', ['rolled-back-task'])).toBeNull()
  })

  test('recovers an interrupted atomic write when only the temporary file remains', async () => {
    await database?.run(
      'INSERT INTO tasks (id, title, sort_order, completed_at, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      ['recovered-task', 'Recovered', 1, '2026-07-22T09:00:00.000Z', '2026-07-22T09:00:00.000Z']
    )
    database?.close()
    database = null
    await rename(databasePath, `${databasePath}.tmp`)

    database = await createSqliteAppDatabase(databasePath)

    expect(database.get<{ title: string }>('SELECT title FROM tasks WHERE id = ?', ['recovered-task'])?.title).toBe(
      'Recovered'
    )
  })

  test('falls back to the last valid backup when the main file is corrupt', async () => {
    await database?.run(
      'INSERT INTO tasks (id, title, sort_order, completed_at, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      ['backed-up-task', 'Backed up', 1, '2026-07-22T09:00:00.000Z', '2026-07-22T09:00:00.000Z']
    )
    await database?.run(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
      ['themePreference', '"dark"', '2026-07-22T09:01:00.000Z']
    )
    database?.close()
    database = null
    await copyFile(databasePath, `${databasePath}.bak`)
    await writeFile(databasePath, Buffer.from('not a sqlite database'))

    database = await createSqliteAppDatabase(databasePath)

    expect(database.get<{ title: string }>('SELECT title FROM tasks WHERE id = ?', ['backed-up-task'])?.title).toBe(
      'Backed up'
    )
  })
})
