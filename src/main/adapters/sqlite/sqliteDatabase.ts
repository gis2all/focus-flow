import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import initSqlJs, { type Database, type SqlValue } from 'sql.js'
import { sqliteSchema } from './schema'

type SqlParams = SqlValue[]

export interface SqliteAppDatabase {
  run(sql: string, params?: SqlParams): Promise<number>
  get<T extends Record<string, unknown>>(sql: string, params?: SqlParams): T | null
  all<T extends Record<string, unknown>>(sql: string, params?: SqlParams): T[]
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
  constructor(
    private readonly filePath: string,
    private readonly database: Database
  ) {}

  async run(sql: string, params: SqlParams = []): Promise<number> {
    this.database.run(sql, params)
    const changedRows = this.database.getRowsModified()
    await this.flush()
    return changedRows
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
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, Buffer.from(this.database.export()))
  }

  close(): void {
    this.database.close()
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
  const database = existsSync(filePath) ? new SQL.Database(await readFile(filePath)) : new SQL.Database()
  const appDatabase = new SqlJsAppDatabase(filePath, database)

  database.run(sqliteSchema)
  ensureTaskSortOrderColumn(database)
  backfillActiveTaskSortOrder(database)
  await appDatabase.flush()

  return appDatabase
}
