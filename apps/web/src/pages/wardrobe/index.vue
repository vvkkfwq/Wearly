<template>
  <view class="catalog-page">
    <header class="catalog-header">
      <view>
        <text class="catalog-wordmark">Wearly</text>
        <h1 class="catalog-heading">衣橱</h1>
      </view>
      <component :is="'button'" class="catalog-action" @click="onAdd">
        <image class="action-icon" src="/static/plus.svg" mode="aspectFit" aria-hidden="true" />
        录入单品
      </component>
    </header>
    <view class="filter-bar">
      <CategoryTabs v-model="filter" />
    </view>

    <EmptyState v-if="loadFailed" class="body" text="衣橱加载失败。" action="重试" @action="load" />
    <SkeletonGrid v-else-if="items === null" class="body" />

    <EmptyState
      v-else-if="items.length === 0"
      class="body"
      text="还没有衣服。&#10;拍一件试试。"
      action="拍第一件衣服"
      @action="onAdd"
    />

    <view v-else-if="visibleItems.length === 0" class="body">
      <text class="t-label">这个品类还没有衣服。</text>
    </view>

    <ItemGrid v-else class="body" :items="visibleItems" @select="onSelect" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import CategoryTabs, { type CategoryFilter } from '@/components/CategoryTabs.vue'
import ItemGrid from '@/components/ItemGrid.vue'
import SkeletonGrid from '@/components/SkeletonGrid.vue'
import EmptyState from '@/components/EmptyState.vue'
import { listItems } from '@/api/items'
import { pickGarmentPhoto } from '@/domain/pickGarmentPhoto'
import { useCutoutPolling } from '@/domain/useCutoutPolling'
import type { Item } from '@/domain/types'

const filter = ref<CategoryFilter>('all')
/** null 表示还没加载完，渲染骨架屏 */
const items = ref<Item[] | null>(null)
const loadFailed = ref(false)

const visibleItems = computed(() => {
  const all = items.value ?? []
  return filter.value === 'all' ? all : all.filter((item) => item.category === filter.value)
})

async function load() {
  loadFailed.value = false
  try {
    items.value = await listItems()
    if (!items.value.length) filter.value = 'all'
  } catch {
    loadFailed.value = true
  }
}

onShow(load)
useCutoutPolling(() => items.value?.some((item) => item.cutoutStatus === 'pending') ?? false, async (isCurrent) => {
  const before = items.value
  const fresh = await listItems()
  if (isCurrent() && items.value === before) items.value = fresh
})

function onSelect(item: Item) {
  uni.navigateTo({ url: `/pages/item/detail?id=${item.id}` })
}

function onAdd() {
  pickGarmentPhoto((file) => {
    uni.navigateTo({
      url: '/pages/capture/index',
      success: ({ eventChannel }) => eventChannel.emit('photo', file),
      fail: () => uni.showToast({ title: '无法打开录入页，请重试', icon: 'none' }),
    })
  })
}
</script>

<style lang="scss" scoped>
.catalog-header { border-bottom: 0; }
.filter-bar {
  position: sticky;
  top: var(--window-top, 0px);
  z-index: 5;
  margin-inline: calc(-1 * var(--gutter));
  padding: var(--sp-2) var(--gutter);
  background: var(--bg);
}
.body { padding: var(--sp-2) 0 var(--sp-8); }
</style>
