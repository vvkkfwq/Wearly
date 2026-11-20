import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { DB_FILENAME, openDatabase } from './db.ts'
import { demoDirectory, prepareProductionDirectory } from './data-paths.ts'
import { seedDemo } from './seed.ts'
import { backup, restore } from './snapshots.ts'

test('导入保留编辑和删除，快照还原按既定顺序关联的照片', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'wearly-data-test-'))
  t.after(() => rmSync(root, { force: true, recursive: true }))
  const initial = join(root, 'demo')
  const snapshot = join(root, 'snapshot')
  const restored = join(root, 'restored')
  assert.equal(seedDemo(initial), true)

  const db = openDatabase(join(initial, DB_FILENAME), 'demo')
  try {
    const manifest = JSON.parse(readFileSync(new URL('../seed/demo.json', import.meta.url), 'utf8'))
    const items = db.prepare('SELECT id, category, original_key, cutout_key FROM items ORDER BY created_at').all()
    assert.equal(items.length, 28)
    assert.deepEqual(items.map(({ id, category }) => [id, category]), manifest.items)
    for (const { id, original_key, cutout_key } of items) {
      assert.equal(original_key, cutout_key)
      assert.deepEqual(
        readFileSync(join(initial, 'photos', String(original_key))),
        readFileSync(new URL(`../seed/photos/${id}.webp`, import.meta.url)),
      )
    }
    const members = db.prepare('SELECT item_id FROM outfit_items WHERE outfit_id = ? ORDER BY position')
    const outfits = db.prepare('SELECT id, favorite FROM outfits ORDER BY created_at').all()
    assert.equal(outfits.length, 6)
    assert.deepEqual(outfits.map(({ id, favorite }) => [
      id, members.all(String(id)).map(({ item_id }) => item_id), Boolean(favorite),
    ]), manifest.outfits)
    db.exec("UPDATE items SET archived = 1, category = 'outer' WHERE id = 't2'")
    db.exec("UPDATE outfits SET favorite = 0 WHERE id = 'f1'")
    db.exec("DELETE FROM outfits WHERE id = 'f6'")
  } finally {
    db.close()
  }

  assert.equal(seedDemo(initial), false)
  backup(initial, snapshot)
  restore(snapshot, restored)
  assert.throws(() => restore(snapshot, restored), /already exists/)
  const recovered = openDatabase(join(restored, DB_FILENAME), 'demo')
  try {
    assert.equal(recovered.prepare("SELECT archived FROM items WHERE id = 't2'").get()?.archived, 1)
    assert.equal(recovered.prepare("SELECT category FROM items WHERE id = 't2'").get()?.category, 'outer')
    assert.equal(recovered.prepare("SELECT favorite FROM outfits WHERE id = 'f1'").get()?.favorite, 0)
    assert.equal(recovered.prepare("SELECT favorite FROM outfits WHERE id = 'f6'").get(), undefined)
    assert.deepEqual(recovered.prepare("SELECT item_id FROM outfit_items WHERE outfit_id = 'f1' ORDER BY position")
      .all().map(({ item_id }) => item_id), ['t2', 'b2', 's1', 'g2'])
    assert.deepEqual(readFileSync(join(restored, 'photos/seed-t2.webp')), readFileSync(join(initial, 'photos/seed-t2.webp')))
  } finally {
    recovered.close()
  }

  writeFileSync(join(snapshot, 'photos/seed-t2.webp'), 'corrupt')
  const rejected = join(root, 'rejected')
  assert.throws(() => restore(snapshot, rejected), /checksum mismatch/)
  assert.equal(existsSync(rejected), false)
})

test('生产迁移需要显式独立目录，生产库与演示库互拒', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'wearly-production-test-'))
  t.after(() => rmSync(root, { force: true, recursive: true }))
  assert.throws(() => prepareProductionDirectory(undefined), /absolute path/)
  assert.throws(() => prepareProductionDirectory('relative'), /absolute path/)
  assert.throws(() => prepareProductionDirectory(demoDirectory), /outside the repository|no such file/)
  assert.throws(() => prepareProductionDirectory(join(root, 'missing')), /no such file/)
  const production = join(root, 'production')
  mkdirSync(production)
  const { database } = prepareProductionDirectory(production)
  const db = openDatabase(database, 'production')
  try {
    for (const table of ['items', 'outfits', 'outfit_items', 'wardrobes']) {
      assert.equal(db.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count, 0)
    }
  } finally {
    db.close()
  }
  assert.throws(() => seedDemo(production), /environment mismatch/)
  const demo = join(root, 'demo')
  seedDemo(demo)
  assert.throws(() => openDatabase(join(demo, DB_FILENAME), 'production'), /environment mismatch/)
})
