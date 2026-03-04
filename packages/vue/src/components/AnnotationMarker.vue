<script setup lang="ts">
/**
 * AnnotationMarker.vue
 *
 * Positioned numbered badge rendered at each annotation's target element.
 * Finds the element via CSS selector, tracks position on scroll/resize,
 * and emits click for panel selection.
 */

import { ref, computed, onMounted, onUnmounted, watch, defineOptions } from 'vue'
import type { Annotation } from '@vuepoint/core'

defineOptions({ name: 'AnnotationMarker' })

const props = defineProps<{
  annotation: Annotation
  index: number
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

// ─── Area annotation detection ──────────────────────────────────────────────

const isAreaAnnotation = computed(() => !!props.annotation.areaRect)
const isTextAnnotation = computed(() => !!props.annotation.selectedText)

// ─── Position tracking ───────────────────────────────────────────────────────

const top = ref(0)
const left = ref(0)
const areaWidth = ref(0)
const areaHeight = ref(0)
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
  // Text selection annotations use stored rect
  if (isTextAnnotation.value && props.annotation.textSelectionRect) {
    const r = props.annotation.textSelectionRect
    top.value = r.y + r.scrollY
    left.value = r.x + r.scrollX
    areaWidth.value = r.width
    areaHeight.value = r.height
    visible.value = true
    return
  }

  // Area annotations use stored rect, not a CSS selector
  if (isAreaAnnotation.value && props.annotation.areaRect) {
    const r = props.annotation.areaRect
    // Convert from viewport coords to page coords using stored scroll offsets
    top.value = r.y + r.scrollY
    left.value = r.x + r.scrollX
    areaWidth.value = r.width
    areaHeight.value = r.height
    visible.value = true
    return
  }

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
  <!-- Text selection annotation: highlight background -->
  <div
    v-if="visible && isTextAnnotation"
    data-vuepoint="true"
    class="vp-text-marker"
    :class="statusClass"
    :style="{
      top: top + 'px',
      left: left + 'px',
      width: areaWidth + 'px',
      height: areaHeight + 'px',
    }"
    :title="`#${index} — ${annotation.elementDescription}`"
    @click.stop="handleClick"
  >
    <span class="vp-text-badge" :class="statusClass">{{ index }}</span>
  </div>

  <!-- Area annotation: dashed border rectangle -->
  <div
    v-else-if="visible && isAreaAnnotation"
    data-vuepoint="true"
    class="vp-area-marker"
    :class="statusClass"
    :style="{
      top: top + 'px',
      left: left + 'px',
      width: areaWidth + 'px',
      height: areaHeight + 'px',
    }"
    :title="`#${index} — ${annotation.elementDescription}`"
    @click.stop="handleClick"
  >
    <span class="vp-area-badge" :class="statusClass">{{ index }}</span>
  </div>

  <!-- Standard annotation: numbered badge -->
  <div
    v-else-if="visible"
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

/* ── Area annotation marker (dashed border rectangle) ──────────────────── */
.vp-area-marker {
  position: absolute;
  pointer-events: auto;
  border: 2px dashed #f59e0b;
  border-radius: 4px;
  z-index: 2147483645;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.vp-area-marker:hover {
  border-width: 3px;
}

.vp-area-marker.vp-marker--pending {
  border-color: #4f81bd;
}

.vp-area-marker.vp-marker--acknowledged {
  border-color: #f59e0b;
}

.vp-area-marker.vp-marker--resolved {
  border-color: #22c55e;
}

.vp-area-marker.vp-marker--dismissed {
  border-color: #6b7280;
}

/* Small numbered badge in top-left corner of area marker */
.vp-area-badge {
  position: absolute;
  top: -10px;
  left: -10px;
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
  user-select: none;
  box-shadow: 0 1px 4px var(--vp-shadow-fab, rgba(0, 0, 0, 0.3));
}

.vp-area-badge.vp-marker--pending { background: #4f81bd; }
.vp-area-badge.vp-marker--acknowledged { background: #f59e0b; }
.vp-area-badge.vp-marker--resolved { background: #22c55e; }
.vp-area-badge.vp-marker--dismissed { background: #6b7280; }

/* ── Text selection annotation marker (highlight) ──────────────────────── */
.vp-text-marker {
  position: absolute;
  pointer-events: auto;
  background: rgba(124, 58, 237, 0.20);
  border-bottom: 2px solid #7c3aed;
  border-radius: 2px;
  z-index: 2147483645;
  cursor: pointer;
  transition: background 0.2s ease;
}

.vp-text-marker:hover {
  background: rgba(124, 58, 237, 0.35);
}

.vp-text-marker.vp-marker--pending {
  background: rgba(124, 58, 237, 0.20);
  border-bottom-color: #7c3aed;
}

.vp-text-marker.vp-marker--acknowledged {
  background: rgba(245, 158, 11, 0.20);
  border-bottom-color: #f59e0b;
}

.vp-text-marker.vp-marker--resolved {
  background: rgba(34, 197, 94, 0.20);
  border-bottom-color: #22c55e;
}

.vp-text-marker.vp-marker--dismissed {
  background: rgba(107, 114, 128, 0.20);
  border-bottom-color: #6b7280;
}

/* Small numbered badge in top-right corner of text highlight */
.vp-text-badge {
  position: absolute;
  top: -10px;
  right: -10px;
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
  user-select: none;
  box-shadow: 0 1px 4px var(--vp-shadow-fab, rgba(0, 0, 0, 0.3));
}

.vp-text-badge.vp-marker--pending { background: #7c3aed; }
.vp-text-badge.vp-marker--acknowledged { background: #f59e0b; }
.vp-text-badge.vp-marker--resolved { background: #22c55e; }
.vp-text-badge.vp-marker--dismissed { background: #6b7280; }
</style>
