<!-- 开发用预览页。拼图定稿后删除，并从 pages.json 移除 -->
<template>
  <view class="wrap">
    <text class="t-label">按真实卡片尺寸渲染，两列</text>
    <view class="grid">
      <view v-for="v in variants" :key="v.title" class="cell">
        <OutfitCard :items="v.items" :favorite="v.favorite" />
        <text class="t-tab caption">{{ v.title }}</text>
      </view>
    </view>

    <text class="t-label">详情页尺寸</text>
    <view class="big">
      <OutfitPuzzle :items="variants[2].items" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import OutfitCard from '@/components/OutfitCard.vue'
import OutfitPuzzle from '@/components/OutfitPuzzle.vue'
import { listItems } from '@/api/items'
import type { Item } from '@/domain/types'

const variants = ref<{ title: string; items: Item[]; favorite: boolean }[]>([])

const pick = (all: Item[], ids: string[]) =>
  ids.map((id) => all.find((i) => i.id === id)!).filter(Boolean)

listItems().then((all) => {
  variants.value = [
    { title: '最少 · 2 件', items: pick(all, ['t1', 'b2']), favorite: false },
    { title: '标准 · 4 件', items: pick(all, ['o4', 't1', 'b2', 's1']), favorite: true },
    {
      title: '叠穿 · 上衣 3 件',
      items: pick(all, ['o1', 't2', 't3', 't8', 'b4', 's3', 'g2', 'a2']),
      favorite: false,
    },
    { title: '连衣裙', items: pick(all, ['d1', 's2', 'g1', 'a1']), favorite: true },
    { title: '单件', items: pick(all, ['o1']), favorite: false },
    { title: '满员 · 含 3 配饰', items: pick(all, ['o3', 't8', 'b5', 's2', 'g1', 'a1', 'a2', 'a3']), favorite: true },
  ]
})
</script>

<style lang="scss" scoped>
.wrap { padding: var(--sp-4); }
.grid {
  margin-bottom: var(--sp-6);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-3);
  margin: var(--sp-2) 0;
}
.cell { min-width: 0; }
.caption {
  display: block;
  color: var(--ink-3);
  text-align: center;
  margin-top: 6px;
}
.big {
  aspect-ratio: 3 / 4;
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  padding: 14px;
  margin-top: var(--sp-2);
}
</style>
