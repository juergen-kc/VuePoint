<script setup lang="ts">
/**
 * AnnotationMarker.vue
 *
 * Positioned numbered badge rendered at each annotation's target element.
 * Finds the element via CSS selector, tracks position on scroll/resize,
 * and emits click for panel selection.
 */

import { ref, onMounted, onUnmounted, watch, defineOptions } from 'vue'
import type { Annotation } from '@vuepoint/core'

defineOptions({ name: 'AnnotationMarker' })

const props = defineProps<{
  annotation: Annotation
  index: number
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

// ─── Position tracking ───────────────────────────────────────────────────────

const top = ref(0)
const left = ref(0)
const visible = ref(false)

let targetEl: Element | null = null
let rafId = 0

function findTarget(): Element | null {
  try {
    return document.querySelector(props.annotation.selector)
  } catch {
    return null
  }
}

function updatePosition() {
  if (!targetEl || !targetEl.isConnected) {
    targetEl = findTarget()
  }
  if (!targetEl) {
    visible.value = false
    return
  }

  const rect = targetEl.getBoundingClientRect()
  // Hide if element is not visible (zero-size or off-screen)
  if (rect.width === 0 && rect.height === 0) {
    visible.value = false
    return
  }

  // Position badge at top-right corner of the element
  top.value = rect.top + window.scrollY - 10
  left.value = rect.right + window.scrollX - 10
  visible.value = true
}

function onScrollOrResize() {
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(updatePosition)
}

onMounted(() => {
  targetEl = findTarget()
  updatePosition()
  window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true })
  window.addEventListener('resize', onScrollOrResize, { passive: true })
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
})

// Re-find target if selector changes
watch(() => props.annotation.selector, () => {
  targetEl = findTarget()
  updatePosition()
})

// ─── Status colors ───────────────────────────────────────────────────────────

const statusClass = ref('')
watch(
  () => props.annotation.status,
  (status) => {
    switch (status) {
      case 'pending': statusClass.value = 'vp-marker--pending'; break
      case 'acknowledged': statusClass.value = 'vp-marker--acknowledged'; break
      case 'resolved': statusClass.value = 'vp-marker--resolved'; break
      case 'dismissed': statusClass.value = 'vp-marker--dismissed'; break
      default: statusClass.value = 'vp-marker--pending'
    }
  },
  { immediate: true },
)

function handleClick() {
  emit('select', props.annotation.id)
}
</script>

<template>
  <div
    v-if="visible"
    data-vuepoint="true"
    class="vp-marker"
    :class="statusClass"
    :style="{ top: top + 'px', left: left + 'px' }"
    :title="`#${index} — ${annotation.elementDescription}`"
    @click.stop="handleClick"
  >
    {{ index }}
  </div>
</template>

<style scoped>
.vp-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: white;
  cursor: pointer;
  z-index: 2147483646;
  box-shadow: 0 1px 4px var(--vp-shadow-fab, rgba(0, 0, 0, 0.3));
  pointer-events: auto;
  transition: transform 0.1s ease, background 0.2s ease;
  user-select: none;
}

.vp-marker:hover {
  transform: scale(1.2);
}

/* Status colors */
.vp-marker--pending {
  background: #4f81bd;
}

.vp-marker--acknowledged {
  background: #f59e0b;
}

.vp-marker--resolved {
  background: #22c55e;
}

.vp-marker--dismissed {
  background: #6b7280;
}
</style>
