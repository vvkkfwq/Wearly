<template>
  <view class="catalog-page capture-page">
    <CatalogPageHeader title="录入单品" @back="goBack" />
    <component v-if="!shot" :is="'button'" class="catalog-action" @click="pickPhoto">拍照或选照片</component>
    <view v-if="shot" class="shot" :class="{ 'garment-surface': previewUrl }">
      <image class="preview" :src="previewUrl || shot.url" mode="aspectFit" />
      <CutoutProgress v-if="processing" />
    </view>
    <view v-if="shot" class="preview-controls">
      <component
        :is="'button'"
        class="text-action preview-action"
        :disabled="saving"
        @click="previewError === 'cutout' ? retryPreview() : pickPhoto()"
      >{{ previewError === 'cutout' ? '重新去背景' : '换一张照片' }}</component>
      <p v-if="previewError" class="t-label" role="alert">
        {{ previewError === 'photo' ? '无法读取这张照片，请换一张。' : '去背景失败，照片还没有保存。' }}
      </p>
    </view>

    <template v-if="shot">
      <section aria-labelledby="capture-categories">
        <h2 id="capture-categories">选品类</h2>
        <view class="cats">
          <component
            :is="'button'"
            v-for="def in CATEGORIES"
            :key="def.key"
            class="cat"
            :class="{ on: def.key === picked }"
            :aria-pressed="def.key === picked"
            @click="picked = def.key"
          >{{ def.label }}</component>
        </view>
      </section>

      <view class="actions">
        <component :is="'button'" class="catalog-action" :disabled="saving || !!previewError" @click="save('again')">存好，再拍一件</component>
        <component :is="'button'" class="catalog-action secondary" :disabled="saving || !!previewError" @click="save('done')">存好，回衣橱</component>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { getCurrentInstance, ref, shallowRef } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import CatalogPageHeader from '@/components/CatalogPageHeader.vue'
import CutoutProgress from '@/components/CutoutProgress.vue'
import { createItem, previewItemCutout } from '@/api/items'
import { CATEGORIES } from '@/domain/categories'
import { waitForMinimumCutoutProgress } from '@/domain/cutoutProgress'
import { normalizeImage } from '@/domain/normalizeImage'
import { pickGarmentPhoto } from '@/domain/pickGarmentPhoto'
import type { Category } from '@/domain/types'

type Shot = { url: string; jpeg: Promise<Blob> }
const shot = shallowRef<Shot | null>(null)
const previewUrl = ref('')
const processing = ref(false)
const previewError = ref<'photo' | 'cutout' | null>(null)
let pendingPreview: Promise<boolean> | undefined
let previewRequest: AbortController | undefined
const picked = ref<Category | null>(null)
const saving = ref(false)

const page = getCurrentInstance()?.proxy as { getOpenerEventChannel(): UniApp.EventChannel } | null | undefined
onLoad(() => page?.getOpenerEventChannel()?.once('photo', setPhoto))
onUnload(() => {
  clearPhoto()
})

function clearPhoto() {
  previewRequest?.abort()
  previewRequest = undefined
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (shot.value) URL.revokeObjectURL(shot.value.url)
  previewUrl.value = ''
  shot.value = null
  picked.value = null
  processing.value = false
  previewError.value = null
  pendingPreview = undefined
}

async function previewPhoto(source: Shot) {
  const request = new AbortController()
  previewRequest = request
  const startedAt = performance.now()
  processing.value = true
  previewError.value = null
  let failure: 'photo' | 'cutout' = 'photo'
  let image: Blob | null = null
  try {
    const jpeg = await source.jpeg
    if (request.signal.aborted) return false
    failure = 'cutout'
    image = await previewItemCutout(jpeg, request.signal)
  } catch {
    // Keep the draft available for recovery.
  }
  if (request.signal.aborted) return false
  await waitForMinimumCutoutProgress(startedAt)
  if (request.signal.aborted) return false
  if (image) previewUrl.value = URL.createObjectURL(image)
  previewError.value = image ? null : failure
  processing.value = false
  return Boolean(image)
}

function retryPreview() {
  if (shot.value && !processing.value && !saving.value) {
    pendingPreview = previewPhoto(shot.value)
  }
}

function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/wardrobe/index' })
  }
}

function pickPhoto() {
  pickGarmentPhoto(setPhoto)
}

function setPhoto(file: Blob) {
  clearPhoto()
  const source = { url: URL.createObjectURL(file), jpeg: normalizeImage(file) }
  shot.value = source
  pendingPreview = previewPhoto(source)
}

async function save(next: 'again' | 'done') {
  const source = shot.value
  if (!source || saving.value) return
  if (!picked.value) {
    uni.showToast({ title: '请先选择品类', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const category = picked.value
    const ready = await pendingPreview
    if (!ready || shot.value !== source) return
    await createItem({ jpeg: await source.jpeg, category })
    if (shot.value !== source) return
  } catch {
    uni.showToast({ title: '照片保存失败，请重试', icon: 'none' })
    return
  } finally {
    saving.value = false
  }
  if (next === 'done') {
    goBack()
    return
  }
  uni.showToast({ title: '存好了', icon: 'none' })
  // 系统选图需要新的用户手势，异步保存后显示下一件的拍照入口。
  clearPhoto()
}
</script>

<style lang="scss" scoped>
.capture-page {
  max-width: 520px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}

.shot {
  position: relative;
  aspect-ratio: 4 / 3;
  max-height: 38svh;
  padding: var(--sp-2);
  border-radius: 12px;
  background: var(--canvas);
}

.preview {
  display: block;
  width: 100%;
  height: 100%;
}
.preview-controls { margin-top: var(--sp-2); }
.preview-controls p { margin: var(--sp-1) 0 0; }
.preview-action {
  display: block;
  margin-inline: auto;
  text-decoration: underline dashed;
  text-underline-offset: .22em;
}

h2 {
  margin: var(--sp-4) 0 var(--sp-2);
  font: 600 21px/1.25 var(--font-display);
}

.cats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-2);
}

.cat {
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--selector-bg);
  color: var(--ink);
  font: 500 var(--fs-body)/1.3 var(--font-display);
  cursor: pointer;
}

.cat.on {
  border-color: var(--brand);
  background: var(--brand);
  color: var(--on-brand);
}

.actions {
  display: grid;
  gap: var(--sp-2);
  margin-top: var(--sp-4);
}

.secondary {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
}

.preview-action:disabled,
.actions button:disabled { opacity: .55; cursor: default; }
</style>
