<template>
  <view class="empty">
    <slot name="visual" />
    <text class="text">{{ text }}</text>
    <component :is="'button'" type="button" class="btn" :class="{ ghost }" @click="emit('action')">{{ action }}</component>
  </view>
</template>

<script setup lang="ts">
defineProps<{ text: string; action: string; ghost?: boolean }>()
const emit = defineEmits<{ action: [] }>()
</script>

<style lang="scss" scoped>
/* 空状态是一句话加一个按钮。不要插画，不要引导页 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 320px;
  padding: 0 var(--sp-6);
  text-align: center;
}

.text {
  font-size: var(--fs-action);
  color: var(--ink-2);
  line-height: 1.6;
  white-space: pre-line;
}

.btn {
  min-height: 44px;
  padding: 0 22px;
  border-radius: var(--r-sm);
  border: none;
  background: var(--brand);
  color: var(--on-brand);
  font-size: var(--fs-action);
  font-weight: 500;
  line-height: 44px;

  &.ghost {
    background: transparent;
    color: var(--ink);
    border: 1px solid var(--line);
  }

  &::after { border: none; }
}
</style>
