<template>
  <header class="editor-header">
    <component :is="'button'" class="back" aria-label="返回" @click="emit('back')" />
    <h1>{{ title }}</h1>
    <component
      v-if="menuLabel"
      :is="'button'"
      class="page-menu"
      :aria-label="menuLabel"
      :disabled="menuDisabled"
      @click="emit('menu')"
    />
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string; menuLabel?: string; menuDisabled?: boolean }>()
const emit = defineEmits<{ back: []; menu: [] }>()
</script>

<style lang="scss" scoped>
.editor-header {
  position: relative;
  display: grid;
  place-items: center;
  height: calc(68px + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
  box-sizing: border-box;
}

.editor-header h1 {
  margin: 0;
  font: 600 24px/1.2 var(--font-display);
}

.back, .page-menu {
  position: absolute;
  bottom: 12px;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}

.back { left: -6px; }
.page-menu { right: -6px; }

.page-menu::before {
  display: block;
  width: 3px;
  height: 3px;
  margin: auto;
  border-radius: 50%;
  background: currentColor;
  box-shadow: -6px 0 currentColor, 6px 0 currentColor;
  content: "";
}

.back::before {
  display: block;
  width: 10px;
  height: 10px;
  margin: auto;
  border: solid currentColor;
  border-width: 0 0 1.5px 1.5px;
  transform: rotate(45deg);
  content: "";
}
</style>
