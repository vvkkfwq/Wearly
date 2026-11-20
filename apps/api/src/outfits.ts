import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { Express } from 'express'
import { LOCAL_WARDROBE_ID, transaction } from './db.ts'

interface OutfitRow {
  id: string
  wardrobe_id: string
  favorite: number
  created_at: number
}

function validItemIds(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.length > 0 &&
    ids.every((id) => typeof id === 'string' && id.length > 0) &&
    new Set(ids).size === ids.length
}

export function registerOutfits(app: Express, db: DatabaseSync) {
  const all = db.prepare('SELECT * FROM outfits WHERE wardrobe_id = ? ORDER BY created_at DESC, id DESC')
  const find = db.prepare('SELECT * FROM outfits WHERE wardrobe_id = ? AND id = ?')
  const getItemIds = db.prepare('SELECT item_id FROM outfit_items WHERE outfit_id = ? ORDER BY position')
  const getItem = db.prepare('SELECT archived FROM items WHERE wardrobe_id = ? AND id = ?')
  const insertOutfit = db.prepare('INSERT INTO outfits (id, wardrobe_id, created_at) VALUES (?, ?, ?) RETURNING *')
  const updateOutfit = db.prepare('UPDATE outfits SET favorite = ? WHERE wardrobe_id = ? AND id = ? RETURNING *')
  const deleteOutfit = db.prepare('DELETE FROM outfits WHERE wardrobe_id = ? AND id = ?')
  const clearItems = db.prepare('DELETE FROM outfit_items WHERE outfit_id = ?')
  const insertItem = db.prepare('INSERT INTO outfit_items (wardrobe_id, outfit_id, item_id, position) VALUES (?, ?, ?, ?)')

  function outfitResponse(row: unknown) {
    const item = row as OutfitRow
    return {
      id: item.id, wardrobeId: item.wardrobe_id, favorite: Boolean(item.favorite), createdAt: item.created_at,
      itemIds: getItemIds.all(item.id).map(({ item_id }) => item_id as string),
    }
  }

  function canUseItems(ids: string[], previous?: Set<string>) {
    // 已归档的单品只能留在已引用它的搭配中。
    return ids.every((id) => {
      const item = getItem.get(LOCAL_WARDROBE_ID, id)
      return item && (!item.archived || previous?.has(id))
    })
  }

  function setItems(id: string, ids: string[]) {
    // 调用方在同一个事务中清空并重写关联，以保留完整的成员顺序。
    clearItems.run(id)
    ids.forEach((itemId, position) => insertItem.run(LOCAL_WARDROBE_ID, id, itemId, position))
  }

  app.get('/api/outfits', (_req, res) => {
    res.json(all.all(LOCAL_WARDROBE_ID).map(outfitResponse))
  })

  app.get('/api/outfits/:id', (req, res) => {
    const row = find.get(LOCAL_WARDROBE_ID, req.params.id)
    if (!row) return res.status(404).json({ error: 'outfit_not_found' })
    res.json(outfitResponse(row))
  })

  app.post('/api/outfits', (req, res) => {
    const ids: unknown = req.body?.itemIds
    if (!validItemIds(ids)) return res.status(400).json({ error: 'invalid_item_ids' })

    const created = transaction(db, () => {
      if (!canUseItems(ids)) return null
      const id = randomUUID()
      const row = insertOutfit.get(id, LOCAL_WARDROBE_ID, Date.now())
      setItems(id, ids)
      return outfitResponse(row)
    })
    if (!created) return res.status(409).json({ error: 'item_unavailable' })
    res.status(201).location(`/api/outfits/${created.id}`).json(created)
  })

  app.patch('/api/outfits/:id', (req, res) => {
    const ids: unknown = req.body?.itemIds
    const favorite: unknown = req.body?.favorite
    if (ids !== undefined && !validItemIds(ids)) return res.status(400).json({ error: 'invalid_item_ids' })
    if (favorite !== undefined && typeof favorite !== 'boolean') return res.status(400).json({ error: 'invalid_favorite' })
    if (ids === undefined && favorite === undefined) return res.status(400).json({ error: 'empty_patch' })

    const id = req.params.id
    const updated = transaction(db, () => {
      const row = find.get(LOCAL_WARDROBE_ID, id)
      if (!row) return { status: 404, error: 'outfit_not_found' }
      if (ids !== undefined) {
        const existing = new Set(outfitResponse(row).itemIds)
        if (!canUseItems(ids, existing)) return { status: 409, error: 'item_unavailable' }
        setItems(id, ids)
      }
      const next = favorite === undefined ? row : updateOutfit.get(Number(favorite), LOCAL_WARDROBE_ID, id)
      return { outfit: outfitResponse(next) }
    })
    if (updated.outfit) return res.json(updated.outfit)
    res.status(updated.status).json({ error: updated.error })
  })

  app.delete('/api/outfits/:id', (req, res) => {
    if (!deleteOutfit.run(LOCAL_WARDROBE_ID, req.params.id).changes) {
      return res.status(404).json({ error: 'outfit_not_found' })
    }
    res.sendStatus(204)
  })
}
