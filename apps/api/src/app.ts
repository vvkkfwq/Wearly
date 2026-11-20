import { randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import type { DatabaseSync } from 'node:sqlite'
import express, { type ErrorRequestHandler, type RequestHandler, type Response } from 'express'
import multer from 'multer'
import { createCutoutWorker } from './cutouts.ts'
import { LOCAL_WARDROBE_ID } from './db.ts'
import { registerOutfits } from './outfits.ts'
import { saveCutout } from './photos.ts'

const CATEGORIES = new Set(['top', 'bottom', 'dress', 'outer', 'shoes', 'bag', 'accessory'])
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const upload = multer({
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 1, fieldSize: 32 },
}).single('photo')
const parseUpload: RequestHandler = (req, res, next) => {
  upload(req, res, (error: unknown) => {
    if (!error || error instanceof multer.MulterError) {
      next(error)
      return
    }
    res.status(400).json({ error: 'invalid_upload' })
  })
}

interface ItemRow {
  id: string
  wardrobe_id: string
  category: string
  original_key: string
  cutout_key: string | null
  cutout_status: 'pending' | 'done' | 'failed'
  archived: number
  created_at: number
}

const validatePhoto: RequestHandler = (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: 'photo_required' })
    return
  }
  const { buffer, mimetype } = req.file
  // shortcut: bounded JPEG signature checks for local uploads, decode images before opening uploads to users.
  if (mimetype !== 'image/jpeg' || buffer.length < 5 ||
    buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff ||
    buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) {
    res.status(415).json({ error: 'invalid_jpeg' })
    return
  }
  next()
}

export function createApp(
  db: DatabaseSync, imageDirectory: string, publicOrigin: URL | null = null, cutoutUrl: URL | null = null,
) {
  const app = express()
  const cutouts = createCutoutWorker(db, imageDirectory, cutoutUrl)

  async function renderCutout(jpeg: Buffer, res: Response) {
    if (!cutoutUrl) {
      res.status(503).json({ error: 'cutout_unavailable' })
      return
    }
    const preview = cutouts.preview(jpeg)
    if (!preview) {
      res.status(503).set('Retry-After', '1').json({ error: 'cutout_busy' })
      return
    }
    try {
      return await preview
    } catch (error) {
      console.error('Cutout failed:', error)
      res.status(502).json({ error: 'cutout_failed' })
    }
  }

  function canRetryCutout(item: ItemRow) {
    // 演示单品的原始素材已经是透明 WebP，服务只处理上传的 JPEG。
    return Boolean(cutoutUrl && item.original_key.endsWith('.jpg') && !item.archived)
  }

  function itemResponse(value: unknown) {
    const item = value as ItemRow
    // 换照片或重新去背景后文件键会变，让前端拿到新的图片 URL。
    return {
      id: item.id,
      wardrobeId: item.wardrobe_id,
      category: item.category,
      originalUri: `/api/items/${item.id}/photo?v=${item.original_key}`,
      cutoutUri: item.cutout_key ? `/api/items/${item.id}/cutout?v=${item.cutout_key}` : null,
      cutoutStatus: item.cutout_status,
      canRetryCutout: canRetryCutout(item),
      archived: Boolean(item.archived),
      createdAt: item.created_at,
    }
  }
  app.disable('x-powered-by')
  app.get('/health', (_req, res) => res.json({ status: 'ready' }))
  app.use('/api', (req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Cache-Control', 'no-store')
    const host = req.get('Host') ?? ''
    const origin = req.get('Origin')
    if (publicOrigin) {
      const readRequest = req.method === 'GET' || req.method === 'HEAD'
      if (host !== publicOrigin.host || (origin !== publicOrigin.origin && !(readRequest && origin === undefined))) {
        res.status(403).json({ error: 'invalid_origin' })
        return
      }
      next()
      return
    }

    // shortcut: 演示依赖可信局域网，部署时改用配置的 HTTPS 来源和代理鉴权。
    const hostname = host.split(':')[0]
    const privateAddress = isIP(hostname) === 4 && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
    const allowedHost = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)
      || (privateAddress && /^(\d+\.){3}\d+(:\d+)?$/.test(host))
    if (!allowedHost || (origin && origin !== `http://${host}`)) {
      res.status(403).json({ error: 'local_access_only' })
      return
    }
    next()
  })
  app.use('/api', express.json({ limit: '16kb' }))

  const listItems = db.prepare(`
    SELECT * FROM items
    WHERE wardrobe_id = ? AND (? IS NULL OR category = ?) AND (? = 1 OR archived = 0)
    ORDER BY created_at DESC, id DESC
  `)
  const findItem = db.prepare('SELECT * FROM items WHERE wardrobe_id = ? AND id = ?')
  const insertItem = db.prepare(`
    INSERT INTO items (id, wardrobe_id, category, original_key, cutout_key, created_at, cutout_status)
    VALUES (?, ?, ?, ?, ?, ?, 'done')
    RETURNING *
  `)
  const patchItem = db.prepare(`
    UPDATE items SET category = coalesce(?, category), archived = coalesce(?, archived)
    WHERE wardrobe_id = ? AND id = ?
    RETURNING *
  `)
  const replacePhoto = db.prepare(`
    UPDATE items SET original_key = ?, cutout_key = ?, cutout_status = 'done'
    WHERE wardrobe_id = ? AND id = ? AND original_key = ?
    RETURNING *
  `)
  const retryCutout = db.prepare(`
    UPDATE items SET cutout_status = 'pending' WHERE wardrobe_id = ? AND id = ?
    RETURNING *
  `)

  app.get('/api/items', (req, res) => {
    const { category, includeArchived } = req.query
    if (category !== undefined && (typeof category !== 'string' || !CATEGORIES.has(category))) {
      return res.status(400).json({ error: 'invalid_category' })
    }
    if (includeArchived !== undefined && includeArchived !== 'true' && includeArchived !== 'false') {
      return res.status(400).json({ error: 'invalid_include_archived' })
    }
    const rows = listItems.all(LOCAL_WARDROBE_ID, category ?? null, category ?? null, Number(includeArchived === 'true'))
    res.json(rows.map(itemResponse))
  })

  app.get('/api/items/:id', (req, res) => {
    const item = findItem.get(LOCAL_WARDROBE_ID, req.params.id)
    if (!item) return res.status(404).json({ error: 'item_not_found' })
    res.json(itemResponse(item))
  })

  app.get('/api/items/:id/:variant', (req, res) => {
    const item = findItem.get(LOCAL_WARDROBE_ID, req.params.id)
    const key = req.params.variant === 'photo' ? item?.original_key
      : req.params.variant === 'cutout' ? item?.cutout_key : null
    if (typeof key !== 'string') return res.status(404).json({ error: 'photo_not_found' })
    res.sendFile(key, { root: imageDirectory, cacheControl: false })
  })

  app.post('/api/cutout-preview', parseUpload, validatePhoto, async (req, res) => {
    const webp = await renderCutout(req.file!.buffer, res)
    if (webp) res.type('image/webp').send(webp)
  })

  app.post('/api/items', parseUpload, validatePhoto, async (req, res) => {
    const category: unknown = req.body?.category
    if (typeof category !== 'string' || !CATEGORIES.has(category)) {
      return res.status(400).json({ error: 'invalid_category' })
    }
    const webp = await renderCutout(req.file!.buffer, res)
    if (!webp) return
    const id = randomUUID()
    const item = await saveCutout(imageDirectory, webp,
      (key) => insertItem.get(id, LOCAL_WARDROBE_ID, category, key, key, Date.now()))
    res.status(201).location(`/api/items/${id}`).json(itemResponse(item))
  })

  app.patch('/api/items/:id', (req, res) => {
    const { category, archived } = req.body ?? {}
    if (category !== undefined && (typeof category !== 'string' || !CATEGORIES.has(category))) {
      return res.status(400).json({ error: 'invalid_category' })
    }
    if (archived !== undefined && typeof archived !== 'boolean') {
      return res.status(400).json({ error: 'invalid_archived' })
    }
    if (category === undefined && archived === undefined) return res.status(400).json({ error: 'empty_patch' })

    const item = patchItem.get(category ?? null, archived === undefined ? null : Number(archived),
      LOCAL_WARDROBE_ID, req.params.id)
    if (!item) return res.status(404).json({ error: 'item_not_found' })
    res.json(itemResponse(item))
  })

  app.put('/api/items/:id/photo', parseUpload, validatePhoto, async (req, res) => {
    const id = String(req.params.id)
    const current = findItem.get(LOCAL_WARDROBE_ID, id) as ItemRow | undefined
    if (!current) return res.status(404).json({ error: 'item_not_found' })
    const webp = await renderCutout(req.file!.buffer, res)
    if (!webp) return
    const photoChanged = new Error('Photo changed during cutout')
    try {
      // Keep the old display photo until the new file is ready and still matches this update.
      const item = await saveCutout(imageDirectory, webp, (key) => {
        const updated = replacePhoto.get(key, key, LOCAL_WARDROBE_ID, id, current.original_key)
        if (!updated) throw photoChanged
        return updated
      })
      res.json(itemResponse(item))
    } catch (error) {
      if (error !== photoChanged) throw error
      res.status(409).json({ error: 'photo_changed' })
    }
  })

  app.post('/api/items/:id/cutout', (req, res) => {
    const item = findItem.get(LOCAL_WARDROBE_ID, req.params.id) as ItemRow | undefined
    if (!item) return res.status(404).json({ error: 'item_not_found' })
    if (!canRetryCutout(item)) return res.status(409).json({ error: 'cutout_unavailable' })
    if (item.cutout_status !== 'pending') cutouts.forceRetry(item.id)
    res.status(202).json(itemResponse(retryCutout.get(LOCAL_WARDROBE_ID, item.id)))
    cutouts.wake()
  })

  registerOutfits(app, db)

  const handleError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error)
      return
    }
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE'
      res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'photo_too_large' : 'invalid_upload' })
      return
    }
    if (error.status === 404) {
      res.status(404).json({ error: 'photo_not_found' })
      return
    }
    if (error.status === 400 || error.status === 413) {
      res.status(error.status).json({ error: 'invalid_request_body' })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'internal_error' })
  }

  // 错误中间件放在路由之后，才能接到上传解析和路由处理抛出的异常。
  app.use(handleError)
  cutouts.wake()
  return app
}
