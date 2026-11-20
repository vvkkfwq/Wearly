<template>
  <div class="cutout-progress">
    <div class="sweep" aria-hidden="true" />
    <span class="label" role="status">正在去背景</span>
  </div>
</template>

<style lang="scss" scoped>
.cutout-progress {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}
.sweep {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgb(255 255 255 / 55%) 50%, transparent 70%);
  animation: sweep 1.4s linear infinite;
}
.label {
  position: absolute;
  right: var(--sp-2);
  bottom: var(--sp-2);
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-card);
  background: var(--bg);
  color: var(--ink);
  font: 500 var(--fs-label)/1.4 var(--font-display);
}
@keyframes sweep {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .sweep { display: none; }
}
</style>
