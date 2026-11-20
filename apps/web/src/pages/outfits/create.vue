<template>
  <view class="catalog-page composer">
    <CatalogPageHeader
      :title="editingId ? '编辑搭配' : '新建搭配'"
      :menu-label="editingId ? '搭配操作' : undefined"
      :menu-disabled="!initialLoaded || saving"
      @back="goBack"
      @menu="openMenu"
    />
    <view class="preview garment-surface">
      <OutfitPuzzle v-if="selected.length" :items="selected" />
      <text v-else class="t-label preview-empty">选中的衣物会出现在这里</text>
    </view>

    <section class="picker" aria-labelledby="picker-heading">
      <h2 id="picker-heading">选单品</h2>
      <CategoryTabs v-model="filter" />
      <text v-if="!initialLoaded" class="t-label picker-message">正在加载搭配</text>
      <EmptyState v-else-if="loadFailed" text="衣橱加载失败。" action="重试" @action="load" />
      <text v-else-if="items === null" class="t-label picker-message">正在加载衣橱</text>
      <text v-else-if="!pickerItems.length" class="t-label picker-message">这个品类还没有单品</text>
      <ItemGrid v-else :items="pickerItems" :selected-ids="selectedIds" rail @select="onToggle" />
    </section>

    <aside class="dock">
      <view class="dock-bar">
        <text class="t-action count" aria-live="polite">已选 {{ selected.length }} 件</text>
        <component :is="'button'" class="catalog-action save" :disabled="!initialLoaded || !selected.length || saving" @click="onSave">
          {{ saving ? '保存中' : '保存搭配' }}
        </component>
      </view>
    </aside>

    <CatalogPopup
      v-model:open="popupOpen"
      :title="confirmingDelete ? '删除这套搭配？' : '搭配操作'"
      :confirm-label="confirmingDelete ? '删除搭配' : undefined"
      message="衣服还在衣橱里。这套搭配会从列表中删除。"
      :busy="deleting"
      @confirm="removeOutfit"
    >
      <div v-if="!confirmingDelete" class="popup-choices">
        <component :is="'button'" class="popup-choice" @click="toggleFavorite">
          {{ favorite ? '取消收藏' : '收藏搭配' }}
        </component>
        <component :is="'button'" class="popup-choice destructive" @click="confirmingDelete = true">
          删除搭配
        </component>
      </div>
    </CatalogPopup>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import CatalogPopup from '@/components/CatalogPopup.vue'
import CatalogPageHeader from '@/components/CatalogPageHeader.vue'
import CategoryTabs, { type CategoryFilter } from '@/components/CategoryTabs.vue'
import EmptyState from '@/components/EmptyState.vue'
import ItemGrid from '@/components/ItemGrid.vue'
import OutfitPuzzle from '@/components/OutfitPuzzle.vue'
import { listItems } from '@/api/items'
import { createOutfit, deleteOutfit, getOutfit, updateOutfit } from '@/api/outfits'
import { categoryLabel } from '@/domain/categories'
import { toggleSelection } from '@/domain/outfitSelection'
import type { Item } from '@/domain/types'

const filter = ref<CategoryFilter>('all')
const items = ref<Item[] | null>(null)
const loadFailed = ref(false)
let latestLoad = 0
const selected = ref<Item[]>([])
const initialLoaded = ref(false)
const saving = ref(false)
/** 带 id 进来就是编辑已有搭配，界面完全一样，只有保存动作不同 */
const editingId = ref('')
const favorite = ref(false)
const popupOpen = ref(false)
const confirmingDelete = ref(false)
const deleting = ref(false)

onLoad(async (query) => {
  editingId.value = (query?.id as string) ?? ''
  if (!editingId.value) {
    initialLoaded.value = true
    return
  }
  try {
    const [outfit, all] = await Promise.all([
      getOutfit(editingId.value),
      listItems({ includeArchived: true }),
    ])
    if (!outfit) {
      uni.showToast({ title: '找不到这套搭配', icon: 'none' })
      goBack()
      return
    }
    favorite.value = outfit.favorite
    const byId = new Map(all.map((i) => [i.id, i]))
    selected.value = outfit.itemIds.map((x) => byId.get(x)).filter((i): i is Item => !!i)
    initialLoaded.value = true
  } catch {
    uni.showToast({ title: '搭配加载失败，请重试', icon: 'none' })
    goBack()
  }
})

const selectedIds = computed(() => selected.value.map((item) => item.id))
const pickerItems = computed(() => {
  const available = items.value ?? []
  if (filter.value !== 'all') {
    const archived = selected.value.filter((item) => item.archived && item.category === filter.value)
    return [...archived, ...available]
  }

  return [...selected.value, ...available.filter((item) => !selectedIds.value.includes(item.id))]
})

function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/outfits/index' })
  }
}

/** 只有首次加载显示骨架屏；切换品类时保留旧内容直到新数据到达 */
async function load() {
  const request = ++latestLoad
  loadFailed.value = false
  try {
    const list = await listItems(filter.value === 'all' ? {} : { category: filter.value })
    if (request === latestLoad) items.value = list
  } catch {
    if (request === latestLoad) loadFailed.value = true
  }
}

watch(filter, load, { immediate: true })

function onToggle(item: Item) {
  const previous = selected.value
  selected.value = toggleSelection(previous, item)

  if (!previous.some((entry) => entry.id === item.id)) {
    const removed = previous.filter((entry) => !selectedIds.value.includes(entry.id))
    if (removed.length) {
      const categories = [...new Set(removed.map((entry) => categoryLabel(entry.category)))]
      uni.showToast({ title: `已替换${categories.join('、')}`, icon: 'none' })
    }
  }
}

function openMenu() {
  confirmingDelete.value = false
  popupOpen.value = true
}

async function toggleFavorite() {
  popupOpen.value = false
  try {
    const updated = await updateOutfit(editingId.value, { favorite: !favorite.value })
    favorite.value = updated.favorite
    uni.showToast({ title: favorite.value ? '已收藏' : '已取消收藏', icon: 'none' })
  } catch {
    uni.showToast({ title: '操作失败，请重试', icon: 'none' })
  }
}

async function removeOutfit() {
  if (!editingId.value || deleting.value) return
  deleting.value = true
  try {
    await deleteOutfit(editingId.value)
    popupOpen.value = false
    goBack()
  } catch {
    uni.showToast({ title: '删除失败，请重试', icon: 'none' })
  } finally {
    deleting.value = false
  }
}

async function onSave() {
  if (!initialLoaded.value || !selected.value.length || saving.value) return
  saving.value = true
  try {
    if (editingId.value) {
      await updateOutfit(editingId.value, { itemIds: selectedIds.value })
    } else {
      await createOutfit(selectedIds.value)
    }
    goBack()
  } catch {
    uni.showToast({ title: '保存失败，请重试', icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.composer {
  max-width: 520px;
  padding-bottom: calc(78px + env(safe-area-inset-bottom, 0px));
}

.preview {
  position: relative;
  height: clamp(210px, calc(100svh - 398px), 396px);
  padding: clamp(12px, 3.8vw, 20px);
  border-radius: 12px;
}

.preview-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.picker { margin-top: 18px; }

.picker h2 {
  margin: 0 0 var(--sp-2);
  font: 600 21px/1.25 var(--font-display);
}

.picker-message {
  display: block;
  padding: var(--sp-4) 0;
}

.picker :deep(.tabs) {
  position: static;
  margin-bottom: var(--sp-2);
}

.dock {
  position: fixed;
  inset: auto 0 0;
  z-index: 10;
  padding: var(--sp-2) var(--gutter) calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--bg);
}

.dock-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  max-width: calc(520px - 2 * var(--gutter));
  min-height: 50px;
  margin: auto;
  padding: 4px 4px 4px var(--sp-4);
  border-radius: 12px;
  background: var(--selector-bg);
}

.count, .save { font: 600 var(--fs-body)/1.3 var(--font-display); }
.save { width: 46%; }
.save:disabled { opacity: .55; cursor: default; }
</style>
