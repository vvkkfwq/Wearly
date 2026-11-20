import { createHash } from 'node:crypto'
import {
  copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DB_FILENAME } from './db.ts'

const MANIFEST = 'snapshot.json'

function regularFile(path: string) {
  const info = lstatSync(path)
  if (!info.isFile()) throw new Error(`Expected a regular file: ${path}`)
  return path
}

function photoFiles(database: string) {
  const db = new DatabaseSync(regularFile(database), { readOnly: true })
  try {
    if (db.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok' ||
        db.prepare('PRAGMA foreign_key_check').get()) {
      throw new Error('SQLite snapshot failed its integrity checks')
    }
    return db.prepare(`
      SELECT original_key AS key FROM items
      UNION SELECT cutout_key FROM items WHERE cutout_key IS NOT NULL
      ORDER BY key
    `).all().map(({ key }) => {
      if (typeof key !== 'string' || !/^[\w-]+\.(jpg|webp)$/.test(key)) {
        throw new Error('Invalid photo key in snapshot')
      }
      return join('photos', key)
    })
  } finally {
    db.close()
  }
}

function digest(path: string) {
  return createHash('sha256').update(readFileSync(regularFile(path))).digest('hex')
}

function publishDirectory(destination: string, write: (staging: string) => void) {
  const parent = dirname(destination)
  mkdirSync(parent, { recursive: true, mode: 0o700 })
  if (lstatSync(destination, { throwIfNoEntry: false })) throw new Error(`Destination already exists: ${destination}`)
  const staging = mkdtempSync(join(parent, '.wearly-'))
  try {
    write(staging)
    // Reserve the destination atomically. Rename publishes the complete directory on the same filesystem.
    mkdirSync(destination, { mode: 0o700 })
    try {
      renameSync(staging, destination)
    } catch (error) {
      try { rmdirSync(destination) } catch { /* preserve any files created concurrently */ }
      throw error
    }
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

export function backup(source: string, destination: string) {
  publishDirectory(destination, (staging) => {
    const db = new DatabaseSync(regularFile(join(source, DB_FILENAME)), { readOnly: true })
    try {
      db.exec('PRAGMA busy_timeout = 5000')
      db.prepare('VACUUM INTO ?').run(join(staging, DB_FILENAME))
    } finally {
      db.close()
    }
    mkdirSync(join(staging, 'photos'), { mode: 0o700 })
    // 以快照中的引用为准，即使原库同时换照片也能复制正确的文件版本。
    const photos = photoFiles(join(staging, DB_FILENAME))
    for (const file of photos) {
      copyFileSync(regularFile(join(source, file)), join(staging, file))
    }
    const files = Object.fromEntries([DB_FILENAME, ...photos].map((file) => [file, digest(join(staging, file))]))
    writeFileSync(join(staging, MANIFEST), JSON.stringify({ version: 1, files }, null, 2), { mode: 0o600 })
  })
}

export function restore(snapshot: string, destination: string) {
  const manifest = JSON.parse(readFileSync(regularFile(join(snapshot, MANIFEST)), 'utf8'))
  if (manifest.version !== 1 || !manifest.files) throw new Error('Unsupported snapshot manifest')

  publishDirectory(destination, (staging) => {
    mkdirSync(join(staging, 'photos'), { mode: 0o700 })
    function restoreFile(file: string) {
      const target = join(staging, file)
      copyFileSync(regularFile(join(snapshot, file)), target)
      if (manifest.files[file] !== digest(target)) throw new Error(`Snapshot checksum mismatch: ${file}`)
    }
    restoreFile(DB_FILENAME)
    const photos = photoFiles(join(staging, DB_FILENAME))
    for (const file of photos) restoreFile(file)
  })
}
