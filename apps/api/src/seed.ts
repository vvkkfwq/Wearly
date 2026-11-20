import { constants, copyFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCAL_WARDROBE_ID, openDatabase, transaction } from './db.ts'
import { prepareDataDirectory } from './data-paths.ts'

interface DemoManifest {
  createdAt: string
  items: [id: string, category: string][]
  outfits: [id: string, itemIds: string[], favorite: boolean][]
}

const seedDirectory = fileURLToPath(new URL('../seed', import.meta.url))

export function seedDemo(directory: string): boolean {
  const { database, photos } = prepareDataDirectory(directory)
  const db = openDatabase(database, 'demo')
  try {
    return transaction(db, () => {
      // 用整批导入标记保留用户的删除操作，已删除的种子搭配不会被补回。
      if (db.prepare("SELECT 1 FROM app_metadata WHERE key = 'demo_seed_v1'").get()) return false

      const manifest: DemoManifest = JSON.parse(readFileSync(join(seedDirectory, 'demo.json'), 'utf8'))
      const createdAt = Date.parse(manifest.createdAt)
      const hasItem = db.prepare('SELECT 1 FROM items WHERE wardrobe_id = ? AND id = ?')
      const insertItem = db.prepare(`
        INSERT INTO items (id, wardrobe_id, category, original_key, cutout_key, cutout_status, created_at)
        VALUES (?, ?, ?, ?, ?, 'done', ?)
      `)
      manifest.items.forEach(([id, category], i) => {
        if (hasItem.get(LOCAL_WARDROBE_ID, id)) return
        const source = join(seedDirectory, 'photos', `${id}.webp`)
        const key = `seed-${id}.webp`
        const target = join(photos, key)
        try {
          copyFileSync(source, target, constants.COPYFILE_EXCL)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST' ||
              !readFileSync(source).equals(readFileSync(target))) throw error
        }
        insertItem.run(id, LOCAL_WARDROBE_ID, category, key, key, createdAt + i * 60_000)
      })

      const insertOutfit = db.prepare(`
        INSERT INTO outfits (id, wardrobe_id, favorite, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `)
      const insertMember = db.prepare(
        'INSERT INTO outfit_items (wardrobe_id, outfit_id, item_id, position) VALUES (?, ?, ?, ?)',
      )
      manifest.outfits.forEach(([id, itemIds, favorite], i) => {
        const inserted = insertOutfit.run(id, LOCAL_WARDROBE_ID, Number(favorite), createdAt + i * 3_600_000)
        if (!inserted.changes) return
        itemIds.forEach((itemId, position) => insertMember.run(LOCAL_WARDROBE_ID, id, itemId, position))
      })

      db.exec("INSERT INTO app_metadata (key, value) VALUES ('demo_seed_v1', '1')")
      return true
    })
  } finally {
    db.close()
  }
}
