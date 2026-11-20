<template>
  <view class="card garment-surface">
    <image v-if="favorite" class="favorite" src="/static/heart-on.svg" mode="aspectFit" aria-hidden="true" />
    <view class="puzzle-area">
      <OutfitPuzzle :items="items" dense />
    </view>
  </view>
  <view class="caption">
    <text>{{ items.length }} 件单品</text>
  </view>
</template>

<script setup lang="ts">
import OutfitPuzzle from './OutfitPuzzle.vue'
import type { Item } from '@/domain/types'

defineProps<{ items: Item[]; favorite?: boolean }>()
</script>

<style lang="scss" scoped>
/* 卡片统一 3:4。单品少的就是留白多——网格整齐比单张饱满更重要 */
.card {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: var(--r-card);
  overflow: hidden;
}

.puzzle-area {
  position: absolute;
  inset: 8%;
}

.caption {
  padding: 6px 0 2px;
  text-align: center;
  font-family: var(--font-display);
  color: var(--ink-2);
  font-size: var(--fs-label);
}

.favorite {
  position: absolute;
  top: 7px;
  left: 7px;
  z-index: 1;
  width: 18px;
  height: 18px;
}
</style>
