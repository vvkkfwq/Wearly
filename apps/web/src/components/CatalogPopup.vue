<template>
  <uni-popup ref="popup" :type="confirmLabel ? 'center' : 'bottom'" :safe-area="false"
    :is-mask-click="!busy" mask-background-color="rgba(40, 32, 22, .36)" @change="onChange">
    <section ref="panel" class="panel" :class="{ confirmation: confirmLabel }"
      role="dialog" aria-modal="true" :aria-label="title" :aria-busy="busy" tabindex="-1"
      @click.stop @touchstart.stop
      @keydown.tab="keepFocus" @keydown.esc.stop.prevent="dismiss" @keyup.esc.stop>
      <header class="heading">
        <h2>{{ title }}</h2>
        <component v-if="!confirmLabel" :is="'button'" class="close" aria-label="关闭" @click="dismiss" />
      </header>
      <slot />
      <template v-if="confirmLabel">
        <p class="message">{{ message }}</p>
        <div class="confirm-actions">
          <component :is="'button'" class="catalog-action cancel" :disabled="busy" @click="dismiss">取消</component>
          <component :is="'button'" class="catalog-action danger" :disabled="busy" @click="emit('confirm')">
            {{ confirmLabel }}
          </component>
        </div>
      </template>
    </section>
  </uni-popup>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
  confirmLabel?: string
  message?: string
  busy?: boolean
}>()

const emit = defineEmits<{ 'update:open': [boolean]; confirm: [] }>()
const popup = ref<{ open: () => void; close: () => void }>()
const panel = ref<HTMLElement>()
let visible = false
let trigger: HTMLElement | null = null

watch(() => props.open, (open) => {
  if (open && !visible) {
    trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    popup.value?.open()
  } else if (!open && visible) {
    popup.value?.close()
  }
}, { flush: 'post' })

watch([panel, () => props.title], async ([element]) => {
  if (!props.open || !element) return
  await nextTick()
  const target = element.querySelector<HTMLElement>('.cancel') ?? element
  target.focus({ preventScroll: true })
})

function onChange({ show }: { show: boolean }) {
  visible = show
  if (!show) {
    dismiss()
    trigger?.focus({ preventScroll: true })
    trigger = null
  }
}

function dismiss() {
  if (!props.busy) emit('update:open', false)
}

function keepFocus(event: KeyboardEvent) {
  const buttons = Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])
  const first = buttons[0]
  const last = buttons[buttons.length - 1]
  if (!first) {
    event.preventDefault()
    return
  }

  const current = document.activeElement
  if (event.shiftKey && (current === first || current === panel.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && current === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<style lang="scss" scoped>
.panel {
  width: min(100vw, 520px);
  max-height: min(84vh, 84dvh);
  margin-inline: auto;
  overflow: auto;
  box-sizing: border-box;
  padding: 14px 20px calc(20px + env(safe-area-inset-bottom, 0px));
  border-radius: 16px 16px 0 0;
  background: var(--bg);
  color: var(--ink);
  overscroll-behavior: contain;
}

.panel:focus { outline: none; }

.confirmation {
  width: min(calc(100vw - 32px), 376px);
  padding: 20px;
  border-radius: 14px;
}

.heading {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}

.heading h2 {
  margin: 0;
  font: 600 21px/1.25 var(--font-display);
}

.close {
  position: relative;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--ink-2);
  cursor: pointer;
}

.close::before, .close::after {
  position: absolute;
  top: 50%;
  left: calc(50% - 7px);
  width: 14px;
  height: 1px;
  transform: rotate(45deg);
  background: currentColor;
  content: "";
}

.close::after { transform: rotate(-45deg); }

.message {
  margin: 0 0 var(--sp-6);
  color: var(--ink-2);
  font-size: var(--fs-action);
  line-height: 1.6;
}

.confirm-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-2);
}

.cancel {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
}

.danger {
  background: #833F35;
  color: var(--on-brand);
}

.confirm-actions button:disabled { opacity: .55; }

:deep(.popup-choices) { display: grid; gap: var(--sp-2); }
:deep(.popup-choices.categories) { grid-template-columns: repeat(2, minmax(0, 1fr)); }

:deep(.popup-choice) {
  min-height: 48px;
  padding: 0 var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--selector-bg);
  color: var(--ink);
  font: 500 var(--fs-body)/1.3 var(--font-display);
  cursor: pointer;
}

:deep(.popup-choice[aria-pressed='true']) {
  border-color: var(--brand);
  background: var(--brand);
  color: var(--on-brand);
}

:deep(.popup-choice.destructive) { color: #833F35; }
</style>
