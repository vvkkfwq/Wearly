import { CATEGORIES, type PuzzleZone } from './categories'
import type { Category, Item } from './types'

export interface PuzzleSlot {
  category: Category
  /** 已截断到 maxPerOutfit */
  items: Item[]
  /** 该品类的实际件数，可能大于 items.length。用于「+N」角标 */
  total: number
  zone: PuzzleZone
  /** 多件时在槽位内横向错位重叠 */
  overlap: boolean
}

/** 分配平铺区域，处理连衣裙互斥以及每个品类的展示上限。 */
export function layoutOutfit(items: Item[]): PuzzleSlot[] {
  const byCategory = new Map<Category, Item[]>()
  for (const item of items) {
    const bucket = byCategory.get(item.category)
    if (bucket) bucket.push(item)
    else byCategory.set(item.category, [item])
  }

  const hasDress = (byCategory.get('dress')?.length ?? 0) > 0

  return CATEGORIES.filter((def) => !(hasDress && (def.key === 'top' || def.key === 'bottom')))
    .map((def) => {
      const all = byCategory.get(def.key) ?? []
      return {
        category: def.key,
        items: all.slice(0, def.maxPerOutfit),
        total: all.length,
        zone: def.zone,
        overlap: def.overlap,
      }
    })
    .filter((s) => s.items.length > 0)
}
