import { ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'

export function useCutoutPolling(
  hasPending: () => boolean,
  refresh: (isCurrent: () => boolean) => Promise<void>,
) {
  const visible = ref(false)
  onShow(() => { visible.value = true })
  onHide(() => { visible.value = false })

  watch([visible, hasPending], ([showing, pending], _before, onCleanup) => {
    if (!showing || !pending) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        await refresh(() => active)
      } catch {
        // A momentary connection failure should leave the current photos visible.
      }
      if (active) timer = setTimeout(poll, 1500)
    }
    timer = setTimeout(poll, 1500)
    onCleanup(() => {
      active = false
      clearTimeout(timer)
    })
  })
}
