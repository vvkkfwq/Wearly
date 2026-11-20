import { createHash } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { LOCAL_WARDROBE_ID } from './db.ts'
import { saveCutout } from './photos.ts'

const MAX_CUTOUT_BYTES = 1024 * 1024
const MAX_PREVIEWS = 8
const PREVIEW_TTL_MS = 5 * 60_000
type PendingItem = { id: string; original_key: string }

function photoHash(jpeg: Buffer) {
  return createHash('sha256').update(jpeg).digest('hex')
}

async function generate(endpoint: URL, jpeg: Buffer) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: new Uint8Array(jpeg),
    signal: AbortSignal.timeout(15_000),
    redirect: 'error',
  })
  if (!response.ok || response.headers.get('content-type') !== 'image/webp' || !response.body) {
    await response.body?.cancel()
    throw new Error(`Unexpected cutout response: ${response.status}`)
  }

  const reader = response.body.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.length
    if (size > MAX_CUTOUT_BYTES) {
      await reader.cancel()
      throw new Error('Cutout exceeds 1 MiB')
    }
    parts.push(value)
  }
  const webp = Buffer.concat(parts, size)
  if (size < 20 || webp.toString('ascii', 0, 4) !== 'RIFF' ||
      webp.toString('ascii', 8, 12) !== 'WEBP' || webp.readUInt32LE(4) !== size - 8) {
    throw new Error('Invalid WebP response')
  }
  return webp
}

export function createCutoutWorker(db: DatabaseSync, directory: string, endpoint: URL | null) {
  const nextItem = db.prepare(`
    SELECT id, original_key FROM items WHERE wardrobe_id = ? AND cutout_status = 'pending'
    ORDER BY created_at, id LIMIT 1
  `)
  const publish = db.prepare(`
    UPDATE items SET cutout_status = ?, cutout_key = coalesce(?, cutout_key)
    WHERE wardrobe_id = ? AND id = ? AND original_key = ? AND cutout_status = 'pending'
  `)
  let running = false
  let queue = Promise.resolve()
  let outstanding = 0
  const previews = new Map<string, { result: Promise<Buffer>; expiresAt: number }>()
  const retries = new Set<string>()

  function schedule(service: URL, jpeg: Buffer) {
    outstanding++
    // 预览和后台任务共用推理顺序，避免争用抠图服务的单个处理名额。
    const result = queue.then(() => generate(service, jpeg)).finally(() => { outstanding-- })
    queue = result.then(() => {}, () => {})
    return result
  }

  function cachedPreview(hash: string) {
    const entry = previews.get(hash)
    if (entry && entry.expiresAt > Date.now()) return entry.result
    previews.delete(hash)
  }

  function preview(jpeg: Buffer) {
    if (!endpoint) return null
    const hash = photoHash(jpeg)
    const cached = cachedPreview(hash)
    if (cached) return cached
    if (outstanding >= MAX_PREVIEWS) return null

    const result = schedule(endpoint, jpeg)
    if (previews.size >= MAX_PREVIEWS) {
      const oldest = previews.keys().next()
      if (!oldest.done) previews.delete(oldest.value)
    }
    previews.set(hash, { result, expiresAt: Date.now() + PREVIEW_TTL_MS })
    void result.catch(() => {
      if (previews.get(hash)?.result === result) previews.delete(hash)
    })
    return result
  }

  async function drain(service: URL) {
    running = true
    try {
      for (;;) {
        const item = nextItem.get(LOCAL_WARDROBE_ID) as PendingItem | undefined
        if (!item) return
        const keys = [LOCAL_WARDROBE_ID, item.id, item.original_key] as const
        const retry = retries.delete(item.id)
        try {
          const jpeg = await readFile(join(directory, item.original_key))
          const earlyResult = retry ? undefined : cachedPreview(photoHash(jpeg))
          const webp = await (earlyResult ?? schedule(service, jpeg))
          // 换照时文件键会变，旧任务只能更新它开始处理时对应的照片。
          const unused = await saveCutout(directory, webp,
            (key) => publish.run('done', key, ...keys).changes ? null : key)
          if (unused) await rm(join(directory, unused), { force: true }).catch(console.error)
        } catch (error) {
          publish.run('failed', null, ...keys)
          console.error(`Cutout failed for item ${item.id}:`, error)
        }
      }
    } finally {
      running = false
    }
  }

  return {
    preview,
    wake() {
      if (endpoint && !running) void drain(endpoint).catch(console.error)
    },
    forceRetry(id: string) {
      retries.add(id)
    },
  }
}
