import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, open, readFile, rename } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import initSqlJs, { type Database, type SqlValue } from 'sql.js'
import { sqliteSchema } from './schema'

type SqlParams = SqlValue[]

export const CURRENT_SCHEMA_VERSION = 2

type TransactionCallback<T> = () => Promise<T> | T

export interface SqliteAppDatabase {
  run(sql: string, params?: SqlParams): Promise<number>
  get<T extends Record<string, unknown>>(sql: string, params?: SqlParams): T | null
  all<T extends Record<string, unknown>>(sql: string, params?: SqlParams): T[]
  transaction<T>(callback: TransactionCallback<T>): Promise<T>
  flush(): Promise<void>
  close(): void
}

const loadSqlJs = async () => {
  const require = createRequire(import.meta.url)
  const wasmFile = require.resolve('sql.js/dist/sql-wasm.wasm')
  const wasmDir = dirname(wasmFile)

  return initSqlJs({
    locateFile: (file) => `${wasmDir}/${file}`
  })
}

class SqlJsAppDatabase implements SqliteAppDatabase {
  private readonly transactionStorage = new AsyncLocalStorage<true>()
  private writeTail: Promise<void> = Promise.resolve()

  constructor(
    private readonly filePath: string,
    private readonly database: Database,
    private shouldRotateBackup: boolean
  ) {}

  async run(sql: string, params: SqlParams = []): Promise<number> {
    if (this.transactionStorage.getStore()) {
      return this.runImmediate(sql, params)
    }

    return this.enqueueWrite(async () => {
      const changedRows = this.runImmediate(sql, params)
      await this.flushAtomic()
      return changedRows
    })
  }

  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    if (this.transactionStorage.getStore()) {
      return callback()
    }

    return this.enqueueWrite(async () => {
      this.database.run('BEGIN')
      try {
        const result = await this.transactionStorage.run(true, callback)
        this.database.run('COMMIT')
        await this.flushAtomic()
        return result
      } catch (error) {
        try {
          this.database.run('ROLLBACK')
        } catch {
          // Preserve the original transaction error if rollback itself fails.
        }
        throw error
      }
    })
  }

  get<T extends Record<string, unknown>>(sql: string, params: SqlParams = []): T | null {
    const statement = this.database.prepare(sql)
    try {
      statement.bind(params)
      if (!statement.step()) return null
      return statement.getAsObject() as T
    } finally {
      statement.free()
    }
  }

  all<T extends Record<string, unknown>>(sql: string, params: SqlParams = []): T[] {
    const statement = this.database.prepare(sql)
    const rows: T[] = []
    try {
      statement.bind(params)
      while (statement.step()) {
        rows.push(statement.getAsObject() as T)
      }
      return rows
    } finally {
      statement.free()
    }
  }

  async flush(): Promise<void> {
    if (this.transactionStorage.getStore()) {
      await this.flushAtomic()
      return
    }

    await this.enqueueWrite(() => this.flushAtomic())
  }

  close(): void {
    this.database.close()
  }

  private runImmediate(sql: string, params: SqlParams): number {
    this.database.run(sql, params)
    return this.database.getRowsModified()
  }

  private async enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.writeTail
    let release!: () => void
    this.writeTail = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }

  private async flushAtomic(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const tempPath = `${this.filePath}.tmp`
    const backupPath = `${this.filePath}.bak`
    const backupTempPath = `${backupPath}.tmp`

    const tempFile = await open(tempPath, 'w')
    try {
      await tempFile.writeFile(Buffer.from(this.database.export()))
      await tempFile.sync()
    } finally {
      await tempFile.close()
    }

    if (this.shouldRotateBackup && existsSync(this.filePath)) {
      await copyFile(this.filePath, backupTempPath)
      await rename(backupTempPath, backupPath)
    }

    await rename(tempPath, this.filePath)
    this.shouldRotateBackup = true
  }
}

const ensureTaskSortOrderColumn = (database: Database): void => {
  const tableInfo = database.exec('PRAGMA table_info(tasks)')
  const hasSortOrder = tableInfo[0]?.values.some((row) => row[1] === 'sort_order') ?? false
  if (!hasSortOrder) {
    database.run('ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0')
  }
}

const backfillActiveTaskSortOrder = (database: Database): void => {
  const result = database.exec(
    `SELECT id
     FROM tasks
     WHERE completed_at IS NULL AND sort_order <= 0
     ORDER BY created_at ASC`
  )
  const rows = result[0]?.values ?? []
  for (let index = 0; index < rows.length; index += 1) {
    const id = rows[index]?.[0]
    if (typeof id !== 'string') continue
    database.run('UPDATE tasks SET sort_order = ? WHERE id = ?', [index + 1, id])
  }
}

export const createSqliteAppDatabase = async (filePath: string): Promise<SqliteAppDatabase> => {
  const SQL = await loadSqlJs()
  const candidates = [
    { path: `${filePath}.tmp`, isPrimary: false },
    { path: filePath, isPrimary: true },
    { path: `${filePath}.bak`, isPrimary: false }
  ]

  let database: Database | null = null
  let loadedFromPrimary = false
  for (const candidate of candidates) {
    if (!existsSync(candidate.path)) continue
    try {
      const candidateDatabase = new SQL.Database(await readFile(candidate.path))
      candidateDatabase.exec('PRAGMA schema_version')
      database = candidateDatabase
      loadedFromPrimary = candidate.isPrimary
      break
    } catch {
      // Try the next recovery candidate when a file is incomplete or corrupt.
    }
  }

  database ??= new SQL.Database()

  migrateDatabase(database)
  const appDatabase = new SqlJsAppDatabase(filePath, database, loadedFromPrimary)
  await appDatabase.flush()

  return appDatabase
}

const migrateDatabase = (database: Database): void => {
  const versionRow = database.exec('PRAGMA user_version')[0]?.values[0]?.[0]
  const version = typeof versionRow === 'number' ? versionRow : Number(versionRow ?? 0)
  if (!Number.isInteger(version) || version < 0 || version > CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported SQLite schema version: ${String(versionRow)}`)
  }

  database.run(sqliteSchema)
  ensureTaskSortOrderColumn(database)
  backfillActiveTaskSortOrder(database)
  database.run(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`)
}
