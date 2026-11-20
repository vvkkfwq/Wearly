import { sortOutfits } from './sortOutfits'
import type { Outfit } from './types'

/**
 * 首页的展示顺序。
 *
 * 排序本身是随机的，但**随机的时机**必须受控：如果每次进首页都重排，从详情
 * 返回时卡片位置全变，刚才看的那张不知道去哪了。
 *
 * 因此顺序在一次会话内固定。新建的搭配排在最前——刚做完的东西应该一眼看到。
 * 想换一批时下拉刷新，调 resetOrder 重排。
 */
let order: string[] | null = null

export function orderedOutfits(list: Outfit[]): Outfit[] {
  if (order === null) {
    const shuffled = sortOutfits(list)
    order = shuffled.map((o) => o.id)
    return shuffled
  }

  const rank = new Map(order.map((id, i) => [id, i]))
  const known: Outfit[] = []
  const fresh: Outfit[] = []
  for (const outfit of list) {
    if (rank.has(outfit.id)) known.push(outfit)
    else fresh.push(outfit)
  }

  known.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  // 新建的按创建时间倒序排在最前
  fresh.sort((a, b) => b.createdAt - a.createdAt)

  const result = [...fresh, ...known]
  order = result.map((o) => o.id)
  return result
}

/** 下拉刷新时调用，下一次读取会重新随机 */
export function resetOrder(): void {
  order = null
}
