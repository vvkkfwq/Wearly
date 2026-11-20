import { describe, expect, it } from 'vitest'
import { layoutOutfit } from './puzzleLayout'
import type { Category, Item } from './types'

let n = 0
const item = (category: Category): Item => ({
  id: `i${++n}`,
  wardrobeId: 'local',
  category,
  originalUri: 'x',
  cutoutUri: 'x',
  cutoutStatus: 'done',
  archived: false,
  createdAt: 0,
})

const cats = (items: Item[]) => layoutOutfit(items).map((s) => s.category)

describe('layoutOutfit', () => {
  it('只渲染有内容的槽位', () => {
    expect(cats([item('top'), item('bottom')])).toEqual(['top', 'bottom'])
  })

  it('空搭配没有任何槽位', () => {
    expect(layoutOutfit([])).toEqual([])
  })

  it('槽位顺序稳定，与传入顺序无关', () => {
    const a = cats([item('shoes'), item('outer'), item('top')])
    const b = cats([item('top'), item('shoes'), item('outer')])
    expect(a).toEqual(b)
    expect(a).toEqual(['top', 'outer', 'shoes'])
  })

  it('连衣裙出现时，上衣与下装不渲染', () => {
    const result = cats([item('dress'), item('top'), item('bottom'), item('shoes')])
    expect(result).toContain('dress')
    expect(result).not.toContain('top')
    expect(result).not.toContain('bottom')
    expect(result).toContain('shoes')
  })

  it('没有连衣裙时不会凭空出现连衣裙槽位', () => {
    expect(cats([item('top')])).not.toContain('dress')
  })

  it('上衣最多 3 件，但 total 记录真实件数', () => {
    const slots = layoutOutfit([item('top'), item('top'), item('top'), item('top'), item('top')])
    expect(slots[0].items).toHaveLength(3)
    expect(slots[0].total).toBe(5)
  })

  it('配饰最多 3 件，下装只留 1 件', () => {
    const slots = layoutOutfit([
      item('accessory'), item('accessory'), item('accessory'), item('accessory'),
      item('bottom'), item('bottom'),
    ])
    const acc = slots.find((s) => s.category === 'accessory')
    const bottom = slots.find((s) => s.category === 'bottom')
    expect(acc?.items).toHaveLength(3)
    expect(bottom?.items).toHaveLength(1)
  })

  it('只有上衣和配饰会重叠', () => {
    const slots = layoutOutfit([item('top'), item('accessory'), item('bag'), item('shoes')])
    expect(slots.filter((s) => s.overlap).map((s) => s.category).sort())
      .toEqual(['accessory', 'top'])
  })

  it('毛衣在左上，裤装在右侧，鞋包在左下', () => {
    const slots = layoutOutfit([item('top'), item('bottom'), item('shoes'), item('bag')])
    expect(slots.map(({ category, zone }) => [category, zone])).toEqual([
      ['top', 'upper'], ['bottom', 'tall'], ['shoes', 'lower'], ['bag', 'lower'],
    ])
  })

  it('连衣裙用右侧长区，外套与鞋仍有各自的区域', () => {
    const slots = layoutOutfit([item('outer'), item('dress'), item('shoes')])
    expect(slots.map(({ category, zone }) => [category, zone])).toEqual([
      ['dress', 'tall'], ['outer', 'upper'], ['shoes', 'lower'],
    ])
  })
})
