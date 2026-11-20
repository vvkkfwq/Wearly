import { randomUUID } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function saveCutout<T>(
  directory: string, bytes: Uint8Array, publish: (key: string) => T,
): Promise<T> {
  const key = `${randomUUID()}.webp`
  const path = join(directory, key)
  try {
    // 发布前先写完文件，备份才能读取数据库引用的每张照片。
    await writeFile(path, bytes, { mode: 0o600, flag: 'wx', flush: true })
    return publish(key)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      await rm(path, { force: true }).catch(console.error)
    }
    throw error
  }
}
