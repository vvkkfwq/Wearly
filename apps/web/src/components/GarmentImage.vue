<template>
  <view class="wrap">
    <image
      v-if="!failed"
      class="img"
      :class="{ cutout: item.cutoutUri }"
      :src="displayUri(item)"
      mode="aspectFit"
      @error="failed = true"
    />
    <!-- 图挂了至少还知道这格是什么，比一个空白格子有用 -->
    <text v-else class="fallback">{{ categoryLabel(item.category) }}</text>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { categoryLabel } from '@/domain/categories'
import { displayUri, type Item } from '@/domain/types'

const props = defineProps<{ item: Item }>()
const failed = ref(false)

watch(() => displayUri(props.item), () => { failed.value = false })
</script>

<style lang="scss" scoped>
.wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.img {
  display: block;
  width: 100%;
  height: 100%;
}

.cutout { filter: drop-shadow(1px 3px 2px rgb(53 40 25 / 18%)); }

.fallback {
  font-size: var(--fs-label);
  color: var(--ink-3);
  text-align: center;
}
</style>
