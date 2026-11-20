<template>
  <scroll-view class="tabs" scroll-x :show-scrollbar="false">
    <view class="row">
      <component
        :is="'button'"
        v-for="tab in tabs"
        :key="tab.key"
        class="tap"
        :class="{ on: tab.key === modelValue }"
        :aria-pressed="tab.key === modelValue"
        @click="emit('update:modelValue', tab.key)"
      >
        {{ tab.label }}
      </component>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import { categoryLabel } from '@/domain/categories'
import type { Category } from '@/domain/types'

export type CategoryFilter = Category | 'all'

defineProps<{ modelValue: CategoryFilter }>()
const emit = defineEmits<{ 'update:modelValue': [CategoryFilter] }>()

const orderedCategories: Category[] = ['top', 'bottom', 'outer', 'dress', 'shoes', 'bag', 'accessory']
const tabs: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  ...orderedCategories.map((key) => ({ key, label: categoryLabel(key) })),
]
</script>

<style lang="scss" scoped>
.tabs {
  position: sticky;
  top: var(--window-top, 0px);
  z-index: 5;
  height: var(--cat-tabs-h);
  border-radius: var(--r-sm);
  background: var(--selector-bg);
  white-space: nowrap;
}

.row { display: flex; width: 100%; align-items: center; }

.tap {
  flex: 0 0 25%;
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--ink);
  font: 500 var(--fs-body)/1 var(--font-display);
  cursor: pointer;
}

.tap.on {
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 600;
}

.tap:focus-visible { outline-offset: -3px; outline-color: currentColor; }
</style>
