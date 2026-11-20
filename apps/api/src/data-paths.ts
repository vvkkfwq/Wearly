import { lstatSync, mkdirSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DB_FILENAME } from './db.ts'

const repository = fileURLToPath(new URL('../../..', import.meta.url))
export const legacyDirectory = fileURLToPath(new URL('../data', import.meta.url))
export const demoDirectory = join(legacyDirectory, 'demo')

function isWithin(parent: string, path: string) {
  const rel = relative(parent, path)
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
}

export function prepareDataDirectory(path: string) {
  mkdirSync(path, { recursive: true, mode: 0o700 })
  const root = realpathSync(path)
  const photos = join(root, 'photos')
  const database = join(root, DB_FILENAME)
  mkdirSync(photos, { recursive: true, mode: 0o700 })
  if (lstatSync(photos).isSymbolicLink()) throw new Error('Photo directory must not be a symlink')
  const dbStat = lstatSync(database, { throwIfNoEntry: false })
  if (dbStat && (!dbStat.isFile() || dbStat.nlink !== 1)) {
    throw new Error('Database must be a regular file dedicated to this data directory')
  }
  return { database, photos }
}

export function prepareProductionDirectory(configured: string | undefined) {
  if (!configured || !isAbsolute(configured)) {
    throw new Error('Production requires WEARLY_DATA_DIR with an absolute path')
  }
  // 要求目标目录已存在，避免把拼错的路径自动建成一套新库。
  const real = realpathSync(configured)
  const checkout = realpathSync(repository)
  if (isWithin(checkout, real) || isWithin(real, checkout)) {
    throw new Error('Production data must be in its own directory outside the repository')
  }
  return prepareDataDirectory(real)
}
