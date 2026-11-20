<template>
  <view class="catalog-page">
    <header class="catalog-header">
      <view>
        <text class="catalog-wordmark">Wearly</text>
        <h1 class="catalog-heading">搭配</h1>
      </view>
      <component :is="'button'" class="catalog-action" @click="goCreate">
        <image class="action-icon" src="/static/plus.svg" mode="aspectFit" aria-hidden="true" />
        新建搭配
      </component>
    </header>
    <EmptyState v-if="loadFailed" text="搭配加载失败。" action="重试" @action="load" />
    <SkeletonCards v-else-if="outfits === null" />

    <EmptyState
      v-else-if="outfits.length === 0"
      :text="`衣橱里有 ${itemCount} 件衣服。&#10;挑几件配一套试试。`"
      action="配一套"
      ghost
      @action="goCreate"
    />

    <view v-else class="bar">
      <text class="t-label">{{ outfits.length }} 套搭配</text>
      <component :is="'button'" class="text-action shuffle" @click="shuffle">换一批</component>
    </view>

    <view v-if="outfits && outfits.length" class="grid">
      <component
        :is="'button'"
        v-for="(row, index) in rows"
        :key="row.outfit.id"
        class="cell"
        :aria-label="`第 ${index + 1} 套搭配，${row.items.length} 件单品${row.outfit.favorite ? '，已收藏' : ''}`"
        @click="open(row.outfit.id)"
      >
        <OutfitCard :items="row.items" :favorite="row.outfit.favorite" />
      </component>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import OutfitCard from '@/components/OutfitCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonCards from '@/components/SkeletonCards.vue'
import { listItems } from '@/api/items'
import { listOutfits } from '@/api/outfits'
import { orderedOutfits, resetOrder } from '@/domain/outfitOrder'
import type { Item, Outfit } from '@/domain/types'

const outfits = ref<Outfit[] | null>(null)
const itemsById = ref(new Map<string, Item>())
const itemCount = ref(0)
const loadFailed = ref(false)

/** 只有首次加载显示骨架屏；之后保留旧内容直到新数据到达，避免闪一下 */
async function load() {
  loadFailed.value = false
  try {
    const [items, list] = await Promise.all([listItems({ includeArchived: true }), listOutfits()])
    itemsById.value = new Map(items.map((i) => [i.id, i]))
    itemCount.value = items.filter((i) => !i.archived).length

    if (list.length === 0 && itemCount.value === 0) {
      uni.switchTab({ url: '/pages/wardrobe/index' })
      return
    }
    outfits.value = orderedOutfits(list)
  } catch {
    loadFailed.value = true
  }
}

onShow(load)

/*
 * 顺序在一次会话内固定，需要一个入口重新洗牌。
 *
 * 没有用下拉刷新：uni-app 在 H5 的实现页面不跟手、阈值和浏览器原生回弹
 * 打架，体验脱节；而且语义也不对——下拉刷新意味着去取最新数据，这里数据
 * 一条没变，只是换个顺序。
 */
async function shuffle() {
  resetOrder()
  await load()
}

const rows = computed(() =>
  (outfits.value ?? []).map((outfit) => ({
    outfit,
    // 已移出衣橱的单品仍然出现在历史搭配里
    items: outfit.itemIds.map((id) => itemsById.value.get(id)).filter((i): i is Item => !!i),
  }))
)

function open(id: string) {
  uni.navigateTo({ url: `/pages/outfits/create?id=${id}` })
}

function goCreate() {
  uni.navigateTo({ url: '/pages/outfits/create' })
}

</script>

<style lang="scss" scoped>
.bar {
  display: flex;
  min-height: 45px;
  align-items: center;
  justify-content: space-between;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-3);
  padding-bottom: var(--sp-8);
}

.cell {
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.shuffle { color: var(--ink-2); }
</style>
