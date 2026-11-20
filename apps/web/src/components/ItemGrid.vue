<template>
  <view class="grid" :class="{ rail }">
    <component
      :is="'button'"
      v-for="(item, index) in items"
      :key="item.id"
      class="cell"
      :class="{ picked: selectedIds?.includes(item.id) }"
      :aria-label="`${categoryLabel(item.category)}，第 ${index + 1} 件${item.cutoutStatus === 'pending' ? '，去背景中' : ''}`"
      :aria-pressed="selectedIds ? selectedIds.includes(item.id) : undefined"
      @click="emit('select', item)"
    >
      <view class="image-tile garment-surface">
        <GarmentImage :item="item" />
        <span v-if="selectedIds?.includes(item.id)" class="selected-mark" aria-hidden="true"></span>
      </view>
      <view class="caption">
        <text>{{ categoryLabel(item.category) }}</text>
        <span v-if="item.cutoutStatus === 'pending'" class="cutout-status">去背景中</span>
      </view>
    </component>
  </view>
</template>

<script setup lang="ts">
import { categoryLabel } from '@/domain/categories'
import GarmentImage from './GarmentImage.vue'
import type { Item } from '@/domain/types'

defineProps<{ items: Item[]; selectedIds?: string[]; rail?: boolean }>()
const emit = defineEmits<{ select: [Item] }>()
</script>

<style lang="scss" scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px var(--sp-2);
}

.cell {
  display: block;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.image-tile {
  position: relative;
  aspect-ratio: 9 / 10;
  overflow: hidden;
  border-radius: var(--r-card);
}

.caption {
  display: block;
  margin-top: 5px;
  font: 500 var(--fs-action)/1.35 var(--font-display);
  padding-inline: 2px;
}
.cutout-status {
  display: block;
  color: var(--ink-2);
  font: var(--fs-label)/1.35 var(--font-display);
}

.rail {
  grid-auto-flow: column;
  grid-auto-columns: clamp(64px, 19.8vw, 92px);
  grid-template-columns: none;
  gap: var(--sp-2);
  overflow-x: auto;
  scrollbar-width: none;
  padding: 4px var(--gutter) 4px 4px;
  margin-inline: -4px calc(-1 * var(--gutter));
}

.rail .image-tile { aspect-ratio: 4 / 5; }
.rail .caption { text-align: center; }

.cell.picked .image-tile {
  outline: 2px solid var(--brand);
  outline-offset: -2px;
}

.selected-mark {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--brand);
}

.selected-mark::after {
  content: "";
  position: absolute;
  left: 5px;
  top: 3px;
  width: 4px;
  height: 7px;
  border: solid var(--on-brand);
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}

</style>
