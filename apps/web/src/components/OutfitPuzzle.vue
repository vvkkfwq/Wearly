<template>
  <view class="puzzle" :class="{ 'two-columns': layout.twoColumns, 'two-rows': layout.twoRows }">
    <view v-for="area in layout.areas" :key="area.zone" class="area" :class="area.zone">
      <view
        v-for="slot in area.slots"
        :key="slot.category"
        class="slot"
        :class="[slot.category, { stack: slot.overlap && slot.items.length > 1 }]"
      >
        <view v-for="item in slot.items" :key="item.id" class="gbox">
          <GarmentImage :item="item" />
        </view>
        <text v-if="slot.hidden > 0" class="more">+{{ slot.hidden }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PuzzleZone } from '@/domain/categories'
import { layoutOutfit } from '@/domain/puzzleLayout'
import GarmentImage from './GarmentImage.vue'
import type { Item } from '@/domain/types'

const props = defineProps<{ items: Item[]; dense?: boolean }>()

// 包先于鞋，保持 A 稿中的横向顺序。
const lowerOrder = ['bag', 'shoes', 'accessory']

const layout = computed(() => {
  const slots = layoutOutfit(props.items).map((slot) => {
    const items = props.dense ? slot.items.slice(0, 1) : slot.items
    return { ...slot, items, hidden: slot.total - items.length }
  })
  const zones: PuzzleZone[] = ['upper', 'lower', 'tall']
  const areas = zones.map((zone) => {
    const inArea = slots.filter((slot) => slot.zone === zone)
    if (zone === 'lower') {
      inArea.sort((a, b) => lowerOrder.indexOf(a.category) - lowerOrder.indexOf(b.category))
    }
    return { zone, slots: inArea }
  }).filter((area) => area.slots.length > 0)

  return {
    areas,
    twoColumns: areas.length > 1 && areas.some((area) => area.zone === 'tall'),
    twoRows: areas.some((area) => area.zone === 'upper') && areas.some((area) => area.zone === 'lower'),
  }
})
</script>

<style lang="scss" scoped>
.puzzle {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 3%;
}

.two-columns { grid-template-columns: minmax(0, 1.28fr) minmax(0, 1fr); }
.two-rows { grid-template-rows: minmax(0, 1.55fr) minmax(0, 1fr); }
.two-columns .tall { grid-column: 2; grid-row: 1 / -1; }

.area, .slot {
  display: flex;
  min-width: 0;
  min-height: 0;
}

.area { gap: 4%; }
.slot { position: relative; flex: 1; }
.gbox { flex: 1; min-width: 0; min-height: 0; }
.stack .gbox + .gbox { margin-left: -16%; }

.more {
  position: absolute;
  right: 2%;
  bottom: 4%;
  font-size: var(--fs-tab);
  line-height: 1;
  color: var(--ink-2);
  background: var(--bg);
  border-radius: 999px;
  padding: 2px 5px;
}
</style>
