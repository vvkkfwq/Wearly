import { describe, expect, it } from 'vitest'
import { toggleSelection } from './outfitSelection'
import type { Category, Item } from './types'

let n = 0
const item = (category: Category, id?: string): Item => ({
  id: id ?? `i${++n}`,
  wardrobeId: 'local',
  category,
  originalUri: 'x',
  cutoutUri: 'x',
  cutoutStatus: 'done',
  archived: false,
  createdAt: 0,
})

const ids = (list: Item[]) => list.map((i) => i.id)

describe('toggleSelection', () => {
  it('再点一次取消选中', () => {
    const a = item('top', 'a')
    expect(toggleSelection([a], a)).toEqual([])
  })

  it('选连衣裙时移除已选的上衣和下装', () => {
    const selected = [item('top', 't'), item('bottom', 'b'), item('shoes', 's')]
    const next = toggleSelection(selected, item('dress', 'd'))
    expect(ids(next)).toEqual(['s', 'd'])
  })

  it('选上衣时移除已选的连衣裙', () => {
    const next = toggleSelection([item('dress', 'd'), item('shoes', 's')], item('top', 't'))
    expect(ids(next)).toEqual(['s', 't'])
  })

  it('单件品类再选一件时顶掉前一件', () => {
    const next = toggleSelection([item('bottom', 'b1')], item('bottom', 'b2'))
    expect(ids(next)).toEqual(['b2'])
  })

  it('上衣第 4 件顶掉最早的那件', () => {
    const selected = [item('top', 't1'), item('top', 't2'), item('top', 't3')]
    const next = toggleSelection(selected, item('top', 't4'))
    expect(ids(next)).toEqual(['t2', 't3', 't4'])
  })

  it('顶替只影响同品类，其他单品原样保留', () => {
    const selected = [item('shoes', 's'), item('bag', 'g'), item('bottom', 'b1')]
    const next = toggleSelection(selected, item('bottom', 'b2'))
    expect(ids(next)).toEqual(['s', 'g', 'b2'])
  })

  it('刚点的那件一定在结果里', () => {
    const cases: Category[] = ['top', 'bottom', 'dress', 'outer', 'shoes', 'bag', 'accessory']
    for (const c of cases) {
      const picked = item(c, `new-${c}`)
      const next = toggleSelection([item('dress', 'd'), item('top', 't'), item('bottom', 'b')], picked)
      expect(ids(next)).toContain(picked.id)
    }
  })
})
