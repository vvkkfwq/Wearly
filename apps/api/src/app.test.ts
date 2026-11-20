import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer, request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createApp } from './app.ts'
import { openDatabase } from './db.ts'

const jpeg = await readFile(new URL('../test/photo.jpg', import.meta.url))
const webp = await readFile(new URL('../seed/photos/o1.webp', import.meta.url))

function photoForm(category?: string, photo: Uint8Array<ArrayBuffer> = new Uint8Array(jpeg)) {
  const body = new FormData()
  if (category !== undefined) body.set('category', category)
  body.set('photo', new Blob([photo], { type: 'image/jpeg' }), 'photo.jpg')
  return body
}

function json(method: string, body: object): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

function requestStatus(url: string, method: string, headers: Record<string, string>, body?: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers }, (res) => { res.resume(); resolve(res.statusCode) })
    req.on('error', reject)
    req.end(body)
  })
}

test('生产 API 要求代理保留外部 Host，写请求需要匹配 HTTPS Origin', async (t) => {
  const db = openDatabase(':memory:', 'production')
  t.after(() => db.close())
  const origin = new URL('https://wearly.example.com:8443')
  const server = createApp(db, tmpdir(), origin).listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const base = `http://127.0.0.1:${address.port}`
    const health = await fetch(`${base}/health`)
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { status: 'ready' })
    const endpoint = `${base}/api/items`
    const host = { Host: origin.host }
    assert.equal(await requestStatus(endpoint, 'GET', host), 200)
    assert.equal(await requestStatus(endpoint, 'GET', {}), 403)
    assert.equal(await requestStatus(endpoint, 'POST', host), 403)
    assert.equal(await requestStatus(endpoint, 'POST', { ...host, Origin: 'https://other.example.com' }), 403)
    assert.equal(await requestStatus(endpoint, 'POST', { ...host, Origin: origin.origin }), 400)
  } finally {
    await server[Symbol.asyncDispose]()
  }
})

test('单品、照片和搭配编辑跨重启保留，归档引用和衣橱边界保持一致', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'wearly-test-'))
  t.after(() => rm(root, { force: true, recursive: true }))
  const photos = join(root, 'photos')
  await mkdir(photos)
  const cutout = createServer((req, res) => {
    req.resume()
    req.on('end', () => res.writeHead(200, { 'Content-Type': 'image/webp' }).end(webp))
  }).listen(0, '127.0.0.1')
  await once(cutout, 'listening')
  t.after(() => cutout[Symbol.asyncDispose]())
  const cutoutAddress = cutout.address()
  assert.ok(cutoutAddress && typeof cutoutAddress === 'object')
  const cutoutUrl = new URL(`http://127.0.0.1:${cutoutAddress.port}/cutout`)

  async function start() {
    const db = openDatabase(join(root, 'wearly.sqlite'), 'test')
    const server = createApp(db, photos, null, cutoutUrl).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    let closed = false
    async function close() {
      if (closed) return
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
      db.close()
      closed = true
    }
    return { rootUrl: `http://127.0.0.1:${address.port}`, db, close }
  }

  const first = await start()
  let item: { id: string; wardrobeId: string; originalUri: string; cutoutStatus: string }
  let outfit: { id: string; itemIds: string[]; favorite: boolean }
  try {
    const upload = await fetch(first.rootUrl + '/api/items', { method: 'POST', body: photoForm('top') })
    assert.equal(upload.status, 201)
    item = await upload.json()
    assert.equal(item.wardrobeId, 'local')
    assert.equal(item.cutoutStatus, 'done')
    assert.equal(upload.headers.get('location'), `/api/items/${item.id}`)

    first.db.exec("INSERT INTO wardrobes (id) VALUES ('other')")
    first.db.exec(`
      INSERT INTO items (id, wardrobe_id, category, original_key, created_at)
      VALUES ('other-item', 'other', 'top', 'other.jpg', 1)
    `)
    assert.equal((await fetch(first.rootUrl + '/api/items/other-item')).status, 404)
    assert.equal((await fetch(first.rootUrl + '/api/items/other-item/photo')).status, 404)
    const secondItem = await (await fetch(first.rootUrl + '/api/items', {
      method: 'POST', body: photoForm('bottom'),
    })).json()
    const outfits = first.rootUrl + '/api/outfits'
    const orderedIds = [secondItem.id, item.id]
    const created = await fetch(outfits, json('POST', { itemIds: orderedIds }))
    assert.equal(created.status, 201)
    outfit = await created.json()
    assert.deepEqual(outfit.itemIds, orderedIds)
    assert.equal((await fetch(outfits, json('POST', { itemIds: ['other-item'] }))).status, 409)
    assert.equal((await fetch(outfits, json('POST', { itemIds: [item.id, item.id] }))).status, 400)

    const itemUrl = first.rootUrl + '/api/items/' + item.id
    const replaced = await fetch(itemUrl + '/photo', { method: 'PUT', body: photoForm() })
    assert.equal(replaced.status, 200)
    const replacement = await replaced.json()
    assert.notEqual(replacement.originalUri, item.originalUri)
    item = await (await fetch(itemUrl, json('PATCH', { category: 'outer', archived: true }))).json()
    assert.equal(item.originalUri, replacement.originalUri)
    const archived = await fetch(outfits, json('POST', { itemIds: [item.id] }))
    assert.equal(archived.status, 409)

    const changed = await fetch(outfits + '/' + outfit.id, json('PATCH', {
      itemIds: [item.id, secondItem.id], favorite: true,
    }))
    assert.equal(changed.status, 200)
    outfit = await changed.json()
    assert.deepEqual(outfit.itemIds, [item.id, secondItem.id])
    assert.equal(outfit.favorite, true)
  } finally {
    await first.close()
  }

  const second = await start()
  try {
    assert.deepEqual(await (await fetch(second.rootUrl + '/api/items?category=outer')).json(), [])
    assert.deepEqual(await (await fetch(second.rootUrl + '/api/items?category=outer&includeArchived=true')).json(), [item])
    assert.deepEqual(await (await fetch(second.rootUrl + '/api/items?category=shoes')).json(), [])
    assert.deepEqual(await (await fetch(second.rootUrl + `/api/items/${item.id}`)).json(), item)
    const photo = await fetch(second.rootUrl + item.originalUri)
    assert.equal(photo.headers.get('content-type'), 'image/webp')
    assert.deepEqual(Buffer.from(await photo.arrayBuffer()), webp)

    const outfitUrl = second.rootUrl + '/api/outfits/' + outfit.id
    assert.deepEqual(await (await fetch(outfitUrl)).json(), outfit)
    assert.deepEqual(await (await fetch(second.rootUrl + '/api/outfits')).json(), [outfit])
    assert.equal((await fetch(outfitUrl, { method: 'DELETE' })).status, 204)
    assert.equal((await fetch(outfitUrl)).status, 404)
    assert.equal(second.db.prepare('SELECT count(*) AS count FROM outfit_items').get()?.count, 0)

    const endpoint = second.rootUrl + '/api/items'
    const lanHeaders = { Host: '192.168.0.100:5173', Origin: 'http://192.168.0.100:5173' }
    assert.equal(await requestStatus(endpoint, 'GET', lanHeaders), 200)
    assert.equal(await requestStatus(endpoint, 'POST', lanHeaders), 400)
    assert.equal(await requestStatus(`${endpoint}/${item.id}`, 'PATCH', { ...lanHeaders, 'Content-Type': 'application/json' }, '{"category":"outer"}'), 200)
    assert.equal(await requestStatus(endpoint, 'GET', { ...lanHeaders, Origin: 'https://example.com' }), 403)
    assert.equal(await requestStatus(endpoint, 'GET', { Host: 'example.com' }), 403)
    for (const [status, body] of [
      [400, photoForm('unknown')],
      [415, photoForm('top', new Uint8Array([1, 2, 3]))],
      [413, photoForm('top', new Uint8Array(2 * 1024 * 1024 + 1))],
    ] as const) {
      assert.equal((await fetch(endpoint, { method: 'POST', body })).status, status)
    }
    assert.equal((await fetch(endpoint, {
      method: 'POST', headers: { Origin: 'https://example.com' }, body: photoForm('top'),
    })).status, 403)
    assert.equal((await fetch(endpoint + '?category=top&category=shoes')).status, 400)
    assert.equal((await (await fetch(endpoint)).json()).length, 1)
  } finally {
    await second.close()
  }
})
