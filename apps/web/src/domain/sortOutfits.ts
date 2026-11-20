import type { Outfit } from './types'

/**
 * 搭配列表的排序。
 *
 * 当前实现：随机。将来接推荐算法时只改这个函数，调用方不动。
 */
export function sortOutfits(outfits: Outfit[]): Outfit[] {
  const out = [...outfits]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
