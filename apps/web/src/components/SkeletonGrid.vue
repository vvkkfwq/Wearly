<template>
  <view class="grid">
    <view v-for="n in count" :key="n" class="skel" />
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 8 })
</script>

<style lang="scss" scoped>
/*
 * 占位块用画布色，尺寸与真实内容完全一致。不用转圈——图片密集的列表里，
 * 占位块比 loading 指示器更能说明"这里将出现什么"，而且尺寸一致就不会有
 * 加载完成时的布局跳动。
 */
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px var(--sp-2);
}

.skel {
  aspect-ratio: 9 / 10;
  min-width: 0;
  border-radius: var(--r-sm);
  background: var(--canvas);
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.55) 50%, transparent 70%);
    animation: sweep 1.4s linear infinite;
  }
}

@keyframes sweep {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .skel::after { animation: none; }
}
</style>
