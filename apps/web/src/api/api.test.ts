import { afterEach, describe, expect, it, vi } from 'vitest'
import { createItem, getItem, listItems, replaceItemPhoto, updateItem } from './items'
import { createOutfit, deleteOutfit, getOutfit, updateOutfit } from './outfits'
import { conflictsWith } from '@/domain/categories'
import { sortOutfits } from '@/domain/sortOutfits'

vi.mock('@/domain/normalizeImage', () => ({
  normalizeImage: async () => new Blob(['jpeg'], { type: 'image/jpeg' }),
}))

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>()
  responses.forEach((response) => fetchMock.mockResolvedValueOnce(response))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('单品 HTTP 客户端', () => {
  it('将品类和归档选项发送给服务端', async () => {
    const fetchMock = stubFetch(Response.json([]))
    await expect(listItems({ category: 'shoes', includeArchived: true })).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledWith('/api/items?category=shoes&includeArchived=true')
  })

  it('只将 404 视作不存在', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 404 }), new Response(null, { status: 500 }))
    await expect(getItem('missing')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/items/missing')
    await expect(getItem('known')).rejects.toThrow('500')
  })

  it('上传压缩照片，并为换照片使用对应单品接口', async () => {
    const fetchMock = stubFetch(Response.json({ id: 'item' }, { status: 201 }), Response.json({ id: 'item' }))
    const blob = new Blob()
    await createItem({ jpeg: new Blob(['jpeg'], { type: 'image/jpeg' }), category: 'top' })
    await replaceItemPhoto('item', blob)
    const [create, replace] = fetchMock.mock.calls
    expect(create[0]).toBe('/api/items')
    expect(create[1]?.method).toBe('POST')
    expect((create[1]?.body as FormData).get('category')).toBe('top')
    expect(replace[0]).toBe('/api/items/item/photo')
    expect(replace[1]?.method).toBe('PUT')
    expect(((replace[1]?.body as FormData).get('photo') as File).type).toBe('image/jpeg')
  })

  it('用 PATCH 修改品类和归档', async () => {
    const fetchMock = stubFetch(Response.json({ id: 'item' }))
    await updateItem('item', { category: 'outer', archived: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/items/item', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ category: 'outer', archived: true }),
    }))
  })
})

describe('搭配 HTTP 客户端', () => {
  it('保持单品顺序并发送收藏和删除操作', async () => {
    const fetchMock = stubFetch(Response.json({}), Response.json({}), new Response(null, { status: 204 }))
    await createOutfit(['b1', 't1'])
    await updateOutfit('f1', { favorite: true })
    await deleteOutfit('f1')
    expect(fetchMock.mock.calls.map(([path, init]) => [path, init?.method, init?.body])).toEqual([
      ['/api/outfits', 'POST', JSON.stringify({ itemIds: ['b1', 't1'] })],
      ['/api/outfits/f1', 'PATCH', JSON.stringify({ favorite: true })],
      ['/api/outfits/f1', 'DELETE', undefined],
    ])
  })

  it('搭配不存在时返回空值', async () => {
    stubFetch(new Response(null, { status: 404 }))
    await expect(getOutfit('missing')).resolves.toBeNull()
  })
})

describe('sortOutfits', () => {
  it('只改顺序，不增不减', () => {
    const outfits = ['f1', 'f2', 'f3'].map((id) => ({
      id, wardrobeId: 'local', itemIds: ['t1'], favorite: false, createdAt: 0,
    }))
    expect(sortOutfits(outfits).map((outfit) => outfit.id).sort()).toEqual(['f1', 'f2', 'f3'])
  })
})

describe('连衣裙与上衣、下装互斥', () => {
  it.each([
    ['dress', 'top', true],
    ['dress', 'bottom', true],
    ['shoes', 'dress', false],
    ['top', 'bottom', false],
  ] as const)('%s + %s = %s', (a, b, expected) => {
    expect(conflictsWith(a, b)).toBe(expected)
  })
})
