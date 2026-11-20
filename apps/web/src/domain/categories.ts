import type { Category } from './types'

export type PuzzleZone = 'upper' | 'lower' | 'tall'

export interface CategoryDef {
  key: Category
  label: string
  zone: PuzzleZone
  /** 一套搭配里最多放几件，超出的不显示 */
  maxPerOutfit: number
  /** 多件时在槽位内横向错位重叠 */
  overlap: boolean
}

export const CATEGORIES: readonly CategoryDef[] = [
  { key: 'top',       label: '上衣',   zone: 'upper', maxPerOutfit: 3, overlap: true  },
  { key: 'bottom',    label: '下装',   zone: 'tall', maxPerOutfit: 1, overlap: false },
  { key: 'dress',     label: '连衣裙', zone: 'tall', maxPerOutfit: 1, overlap: false },
  { key: 'outer',     label: '外套',   zone: 'upper', maxPerOutfit: 1, overlap: false },
  { key: 'shoes',     label: '鞋',     zone: 'lower', maxPerOutfit: 1, overlap: false },
  { key: 'bag',       label: '包',     zone: 'lower', maxPerOutfit: 1, overlap: false },
  { key: 'accessory', label: '配饰',   zone: 'lower', maxPerOutfit: 3, overlap: true  },
]

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]))

export function categoryDef(key: Category): CategoryDef {
  const def = BY_KEY.get(key)
  if (!def) throw new Error(`未知品类：${key}`)
  return def
}

export function categoryLabel(key: Category): string {
  return categoryDef(key).label
}

/** 连衣裙与上衣、下装互斥 */
export function conflictsWith(a: Category, b: Category): boolean {
  const pair = new Set([a, b])
  return pair.has('dress') && (pair.has('top') || pair.has('bottom'))
}
