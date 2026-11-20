<template>
  <view class="catalog-page item-page">
    <CatalogPageHeader
      title="单品"
      :menu-label="item && !item.archived ? '单品操作' : undefined"
      :menu-disabled="replacing"
      @back="goBack"
      @menu="openMenu"
    />
    <template v-if="item">
      <view class="hero" :class="{ 'garment-surface': item.cutoutUri }">
        <GarmentImage :item="item" />
        <CutoutProgress v-if="replacing || retrying || item.cutoutStatus === 'pending'" />
      </view>

      <component :is="'button'" class="category-row" @click="changeCategory">
        <span>品类</span>
        <span class="value">{{ categoryLabel(item.category) }}</span>
      </component>

      <p v-if="usedIn.length" class="t-label used">用在 {{ usedIn.length }} 套搭配里</p>

      <component :is="'button'" class="catalog-action change-photo" :disabled="replacing" @click="changePhoto">
        {{ replacing ? '正在换照片' : '换一张照片' }}
      </component>
      <component
        v-if="item.canRetryCutout"
        :is="'button'"
        class="retry-cutout"
        :disabled="retrying || replacing || item.cutoutStatus === 'pending'"
        @click="retryCutout"
      >重新去背景</component>
    </template>

    <CatalogPopup
      v-model:open="popupOpen"
      :title="panel === 'archive' ? '移出衣橱？' : panel === 'category' ? '选择品类' : '单品操作'"
      :confirm-label="panel === 'archive' ? '移出衣橱' : undefined"
      :message="archiveMessage"
      :busy="archiving"
      @confirm="archive"
    >
      <div v-if="panel === 'category'" class="popup-choices categories">
        <component
          :is="'button'"
          v-for="def in CATEGORIES"
          :key="def.key"
          class="popup-choice"
          :aria-pressed="def.key === item?.category"
          @click="selectCategory(def.key)"
        >{{ def.label }}</component>
      </div>
      <div v-else-if="panel === 'menu'" class="popup-choices">
        <component :is="'button'" class="popup-choice destructive" @click="panel = 'archive'">移出衣橱</component>
      </div>
    </CatalogPopup>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getItem, replaceItemPhoto, retryItemCutout, updateItem } from '@/api/items'
import { listOutfits } from '@/api/outfits'
import { CATEGORIES, categoryLabel } from '@/domain/categories'
import { waitForMinimumCutoutProgress } from '@/domain/cutoutProgress'
import { useCutoutPolling } from '@/domain/useCutoutPolling'
import CatalogPopup from '@/components/CatalogPopup.vue'
import CatalogPageHeader from '@/components/CatalogPageHeader.vue'
import CutoutProgress from '@/components/CutoutProgress.vue'
import GarmentImage from '@/components/GarmentImage.vue'
import type { Category, Item, Outfit } from '@/domain/types'

const id = ref('')
const item = ref<Item | null>(null)
const replacing = ref(false)
const retrying = ref(false)
const usedIn = ref<Outfit[]>([])
const popupOpen = ref(false)
const panel = ref<'menu' | 'category' | 'archive'>('category')
const archiving = ref(false)

const archiveMessage = computed(() => usedIn.value.length
  ? `这件衣服用在 ${usedIn.value.length} 套搭配里，移出后仍会显示在那些搭配中。`
  : '这件单品将从衣橱和新建搭配的列表中移除。'
)

onLoad((query) => {
  id.value = (query?.id as string) ?? ''
})

onShow(load)
useCutoutPolling(() => item.value?.cutoutStatus === 'pending', async (isCurrent) => {
  const before = item.value
  const fresh = await getItem(id.value)
  if (fresh && isCurrent() && item.value === before) item.value = fresh
})

async function load() {
  if (!id.value) {
    goBack()
    return
  }
  try {
    const [found, outfits] = await Promise.all([getItem(id.value), listOutfits()])
    if (!found) {
      goBack()
      return
    }
    item.value = found
    usedIn.value = outfits.filter((o) => o.itemIds.includes(found.id))
  } catch {
    uni.showToast({ title: '单品加载失败，请重试', icon: 'none' })
    goBack()
  }
}

function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/wardrobe/index' })
  }
}

function openMenu() {
  panel.value = 'menu'
  popupOpen.value = true
}

function changeCategory() {
  panel.value = 'category'
  popupOpen.value = true
}

async function selectCategory(category: Category) {
  popupOpen.value = false
  if (!item.value || item.value.category === category) return

  try {
    item.value = await updateItem(item.value.id, { category })
  } catch {
    uni.showToast({ title: '品类修改失败，请重试', icon: 'none' })
  }
}

function changePhoto() {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera', 'album'],
    success: async (res) => {
      const file = (res.tempFiles as unknown as File[])[0]
      if (!file || !item.value || replacing.value) return
      const startedAt = performance.now()
      replacing.value = true
      try {
        const next = await replaceItemPhoto(item.value.id, file)
        await waitForMinimumCutoutProgress(startedAt)
        item.value = next
      } catch {
        uni.showToast({ title: '换照失败，已保留原来的照片', icon: 'none' })
      } finally {
        await waitForMinimumCutoutProgress(startedAt)
        replacing.value = false
      }
    },
  })
}

async function retryCutout() {
  if (!item.value || retrying.value || replacing.value) return
  const startedAt = performance.now()
  retrying.value = true
  const before = item.value
  try {
    const fresh = await retryItemCutout(before.id)
    if (item.value?.originalUri === fresh.originalUri) item.value = fresh
  } catch {
    uni.showToast({ title: '无法重新去背景，请重试', icon: 'none' })
  } finally {
    await waitForMinimumCutoutProgress(startedAt)
    retrying.value = false
  }
}

async function archive() {
  if (!item.value || archiving.value) return
  archiving.value = true
  try {
    await updateItem(item.value.id, { archived: true })
    popupOpen.value = false
    goBack()
  } catch {
    uni.showToast({ title: '移出失败，请重试', icon: 'none' })
  } finally {
    archiving.value = false
  }
}
</script>
<style lang="scss" scoped>
.item-page {
  max-width: 520px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
}

.hero {
  position: relative;
  aspect-ratio: 1;
  max-height: 52svh;
  padding: clamp(8px, 3vw, 16px);
  border-radius: 12px;
  background-color: var(--canvas);
}

.category-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 52px;
  margin-top: var(--sp-4);
  padding: 0 var(--sp-1);
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

.value {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--ink-2);
}

.value::after {
  width: 7px;
  height: 7px;
  margin-right: 3px;
  border: solid currentColor;
  border-width: 1px 1px 0 0;
  transform: rotate(45deg);
  content: "";
}

.used { margin: var(--sp-3) var(--sp-1) 0; }

.change-photo {
  width: 100%;
  margin-top: var(--sp-6);
}

.change-photo:disabled { opacity: .55; cursor: default; }
.retry-cutout {
  width: 100%;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: .22em;
  cursor: pointer;
}
.retry-cutout:disabled { opacity: .55; cursor: default; }
</style>
