import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer, type ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { createApp } from './app.ts'
import { LOCAL_WARDROBE_ID, openDatabase } from './db.ts'

type Item = { id: string; originalUri: string; cutoutUri: string | null; cutoutStatus: string }
const jpeg = await readFile(new URL('../test/photo.jpg', import.meta.url))
const webp = await readFile(new URL('../seed/photos/o1.webp', import.meta.url))

function upload(photo = jpeg) {
  const form = new FormData()
  form.set('category', 'outer')
  form.set('photo', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), 'photo.jpg')
  return form
}

async function waitFor<T>(read: () => T | Promise<T | undefined>) {
  for (let i = 0; i < 100; i++) {
    const value = await read()
    if (value !== undefined) return value
    await delay(20)
  }
  throw new Error('Timed out waiting for cutout')
}

test('新录入只存成图，换照失败保留旧图，旧待办仍可恢复', { timeout: 12_000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'wearly-cutout-'))
  const database = join(folder, 'test.sqlite')
  const photos = join(folder, 'photos')
  await mkdir(photos)
  const calls: ServerResponse[] = []
  const service = createServer((req, res) => {
    req.resume()
    req.on('end', () => calls.push(res))
  }).listen(0, '127.0.0.1')
  await once(service, 'listening')
  const address = service.address()
  assert.ok(address && typeof address === 'object')
  const endpoint = new URL(`http://127.0.0.1:${address.port}/cutout`)

  async function start() {
    const db = openDatabase(database, 'test')
    db.prepare('INSERT OR IGNORE INTO wardrobes (id) VALUES (?)').run(LOCAL_WARDROBE_ID)
    const server = createApp(db, photos, null, endpoint).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    return { db, server, root: `http://127.0.0.1:${address.port}` }
  }

  function succeed(res: ServerResponse) {
    res.writeHead(200, { 'Content-Type': 'image/webp' }).end(webp)
  }

  let api = await start()
  try {
    const preview = fetch(api.root + '/api/cutout-preview', { method: 'POST', body: upload() })
    const previewCall = await waitFor(() => calls.shift())
    const saving = fetch(api.root + '/api/items', { method: 'POST', body: upload() })
    assert.deepEqual(await (await fetch(api.root + '/api/items')).json(), [])
    assert.deepEqual(await readdir(photos), [])
    succeed(previewCall)
    const [created, previewResponse] = await Promise.all([saving, preview])
    assert.equal(created.status, 201)
    assert.equal(previewResponse.status, 200)
    assert.deepEqual(Buffer.from(await previewResponse.arrayBuffer()), webp)
    const original = await created.json() as Item
    assert.equal(original.cutoutStatus, 'done')
    assert.equal(calls.length, 0)
    const files = await readdir(photos)
    assert.equal(files.length, 1)
    assert.match(files[0], /\.webp$/)
    assert.deepEqual(Buffer.from(await (await fetch(api.root + original.originalUri)).arrayBuffer()), webp)
    const path = '/api/items/' + original.id
    const read = async () => await (await fetch(api.root + path)).json() as Item
    assert.equal((await fetch(api.root + path + '/cutout', { method: 'POST' })).status, 409)

    const differentJpeg = Buffer.from(jpeg)
    differentJpeg[25] ^= 1
    const rejectedCreate = fetch(api.root + '/api/items', { method: 'POST', body: upload(differentJpeg) })
    const rejectedCall = await waitFor(() => calls.shift())
    rejectedCall.writeHead(503).end()
    assert.equal((await rejectedCreate).status, 502)
    assert.equal((await (await fetch(api.root + '/api/items')).json()).length, 1)
    const rejectedReplacement = fetch(api.root + path + '/photo', { method: 'PUT', body: upload(differentJpeg) })
    const failedCall = await waitFor(() => calls.shift())
    assert.deepEqual(await read(), original)
    failedCall.writeHead(503).end()
    assert.equal((await rejectedReplacement).status, 502)
    assert.deepEqual(await read(), original)
    assert.deepEqual(await readdir(photos), files)

    const replacing = fetch(api.root + path + '/photo', { method: 'PUT', body: upload(differentJpeg) })
    succeed(await waitFor(() => calls.shift()))
    const replaced = await replacing
    assert.equal(replaced.status, 200)
    assert.notEqual((await replaced.json()).cutoutUri, original.cutoutUri)
    assert.ok((await readdir(photos)).every(file => file.endsWith('.webp')))

    // A pending record created by an earlier version still has a JPEG.
    await writeFile(join(photos, 'legacy.jpg'), jpeg)
    api.db.prepare(`
      INSERT INTO items (id, wardrobe_id, category, original_key, created_at, cutout_status)
      VALUES ('legacy', ?, 'top', 'legacy.jpg', 0, 'pending')
    `).run(LOCAL_WARDROBE_ID)
    await api.server[Symbol.asyncDispose]()
    api.db.close()
    api = await start()
    succeed(await waitFor(() => calls.shift()))
    const resumed = await waitFor(async () => {
      const item = await (await fetch(api.root + '/api/items/legacy')).json() as Item
      if (item.cutoutStatus === 'done') return item
    })
    assert.ok(resumed.cutoutUri)
    assert.deepEqual(await readFile(join(photos, 'legacy.jpg')), jpeg)
  } finally {
    service.closeAllConnections()
    await service[Symbol.asyncDispose]()
    await api.server[Symbol.asyncDispose]()
    api.db.close()
    await rm(folder, { recursive: true, force: true })
  }
})
