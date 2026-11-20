import { categoryDef } from './categories'
import type { Item } from './types'

/**
 * 创建搭配时点选单品。
 *
 * 目标是任何一次点击之后，底部预览里都能看到刚点的那件——不能出现"选了但
 * 拼图里没有"的情况，那比"点不动"更让人困惑。因此不做禁用，改为自动顶替：
 *
 * - 连衣裙与上衣、下装互斥，选其一自动移除另一方
 * - 品类达到上限后再选，顶掉该品类里最早选的那件
 */
export function toggleSelection(selected: Item[], item: Item): Item[] {
  if (selected.some((s) => s.id === item.id)) {
    return selected.filter((s) => s.id !== item.id)
  }

  let next = selected

  if (item.category === 'dress') {
    next = next.filter((s) => s.category !== 'top' && s.category !== 'bottom')
  } else if (item.category === 'top' || item.category === 'bottom') {
    next = next.filter((s) => s.category !== 'dress')
  }

  const max = categoryDef(item.category).maxPerOutfit
  const sameCategory = next.filter((s) => s.category === item.category)
  if (sameCategory.length >= max) {
    const evicted = new Set(sameCategory.slice(0, sameCategory.length - max + 1).map((s) => s.id))
    next = next.filter((s) => !evicted.has(s.id))
  }

  return [...next, item]
}
