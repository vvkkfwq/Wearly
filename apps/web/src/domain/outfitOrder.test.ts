import { beforeEach, describe, expect, it } from 'vitest'
import { orderedOutfits, resetOrder } from './outfitOrder'
import type { Outfit } from './types'

let n = 0
const outfit = (id: string, createdAt = ++n): Outfit => ({
  id,
  wardrobeId: 'local',
  itemIds: ['x'],
  favorite: false,
  createdAt,
})

const ids = (list: Outfit[]) => list.map((o) => o.id)
const many = (count: number) => Array.from({ length: count }, (_, i) => outfit(`o${i}`))

beforeEach(resetOrder)

describe('orderedOutfits', () => {
  it('同一会话内反复读取，顺序不变', () => {
    const list = many(12)
    const first = ids(orderedOutfits(list))
    expect(ids(orderedOutfits(list))).toEqual(first)
    expect(ids(orderedOutfits(list))).toEqual(first)
  })

  it('传入顺序被打乱也不影响已确定的展示顺序', () => {
    const list = many(12)
    const first = ids(orderedOutfits(list))
    expect(ids(orderedOutfits([...list].reverse()))).toEqual(first)
  })

  it('新建的搭配排在最前', () => {
    const list = many(6)
    orderedOutfits(list)
    const fresh = outfit('brand-new', 9999)
    expect(ids(orderedOutfits([...list, fresh]))[0]).toBe('brand-new')
  })

  it('多个新建的按创建时间倒序', () => {
    const list = many(3)
    orderedOutfits(list)
    const a = outfit('a', 100)
    const b = outfit('b', 200)
    expect(ids(orderedOutfits([...list, a, b])).slice(0, 2)).toEqual(['b', 'a'])
  })

  it('删掉的搭配不再出现，其余顺序保持', () => {
    const list = many(6)
    const first = ids(orderedOutfits(list))
    const removed = first[2]
    const after = ids(orderedOutfits(list.filter((o) => o.id !== removed)))
    expect(after).toEqual(first.filter((id) => id !== removed))
  })

  it('不增不减', () => {
    const list = many(20)
    const out = orderedOutfits(list)
    expect(ids(out).sort()).toEqual(ids(list).sort())
  })

  it('resetOrder 之后重新随机', () => {
    const list = many(30)
    const before = ids(orderedOutfits(list))
    resetOrder()
    const attempts = Array.from({ length: 8 }, () => {
      resetOrder()
      return ids(orderedOutfits(list))
    })
    expect(attempts.some((a) => a.join() !== before.join())).toBe(true)
  })
})
