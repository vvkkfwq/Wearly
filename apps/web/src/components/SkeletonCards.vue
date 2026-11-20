<template>
  <view class="grid">
    <view v-for="n in count" :key="n" class="skel" />
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 6 })
</script>

<style lang="scss" scoped>
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-3);
  padding-block: 45px var(--sp-8);
}

/* 占位块与真实卡片同为 3:4，加载完成时不会有布局跳动 */
.skel {
  aspect-ratio: 3 / 4;
  min-width: 0;
  border-radius: var(--r-card);
  border: 1px solid var(--line);
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
