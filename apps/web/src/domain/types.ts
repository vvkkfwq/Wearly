/** 品类。同时决定单品在搭配拼图中的位置，见 categories.ts */
export type Category =
  | 'top'        // 上衣
  | 'bottom'     // 下装（裤 / 半身裙）
  | 'dress'      // 连衣裙
  | 'outer'      // 外套
  | 'shoes'      // 鞋
  | 'bag'        // 包
  | 'accessory'  // 配饰（帽 / 围巾 / 首饰 / 腰带）

/** 去背景的处理状态 */
export type CutoutStatus = 'pending' | 'done' | 'failed'

export interface Item {
  id: string
  wardrobeId: string
  category: Category
  /** 旧单品的原图。新单品的兼容地址指向同一张成图。 */
  originalUri: string
  /** 去背景结果。派生数据，可随时对原图重跑 */
  cutoutUri: string | null
  cutoutStatus: CutoutStatus
  canRetryCutout?: boolean
  /** 已移出衣橱。软删除——历史搭配仍完整展示 */
  archived: boolean
  createdAt: number
}

export interface Outfit {
  id: string
  wardrobeId: string
  /** 至少 1 件 */
  itemIds: string[]
  favorite: boolean
  createdAt: number
}

/** 渲染单品时一律用这个，去背景未完成或失败时回落到原图 */
export function displayUri(item: Item): string {
  return item.cutoutUri ?? item.originalUri
}
