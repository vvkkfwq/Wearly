import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

export const LOCAL_WARDROBE_ID = 'local'
export const DB_FILENAME = 'wearly.sqlite'
export type DataKind = 'demo' | 'test' | 'production'

const migrations = ['001-initial.sql', '002-outfits.sql']

export function transaction<T>(db: DatabaseSync, run: () => T): T {
  // 先取得写事务，再检查待修改的数据，避免校验和写入之间被其他连接改动。
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = run()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function openDatabase(path: string, kind: DataKind): DatabaseSync {
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true })
  try {
    db.exec('PRAGMA busy_timeout = 5000')
    transaction(db, () => {
      const version = db.prepare('PRAGMA user_version').get()?.user_version
      if (typeof version !== 'number' || version < 0 || version > migrations.length) {
        throw new Error(`Unsupported database schema version: ${version}`)
      }
      for (const name of migrations.slice(version)) {
        db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'))
      }
      const mark = db.prepare("SELECT value FROM app_metadata WHERE key = 'environment'").get()?.value
      // Legacy databases had no environment marker and were used only for local demos.
      if ((mark && mark !== kind) || (!mark && kind === 'production' && version !== 0)) {
        throw new Error(`Database environment mismatch: expected ${kind}, found ${mark ?? 'legacy demo'}`)
      }
      db.prepare("INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('environment', ?)").run(kind)
      if (kind !== 'production') {
        db.prepare('INSERT OR IGNORE INTO wardrobes (id) VALUES (?)').run(LOCAL_WARDROBE_ID)
      }
    })
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
