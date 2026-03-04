<script setup lang="ts">
/**
 * VuePointToolbar.vue
 *
 * The main VuePoint overlay. Renders as a fixed pill in the bottom-right
 * corner. When active, intercepts clicks to create annotations.
 *
 * Design principles:
 *   - Zero interference with host app events when inactive
 *   - Visible but unobtrusive — collapses to a small FAB
 *   - Annotation markers are absolutely positioned badges
 *   - All VuePoint DOM is data-vuepoint="true" so the inspector can skip it
 */

import { ref, computed, onMounted, onUnmounted, defineOptions } from 'vue'

defineOptions({ name: 'VuePointToolbar' })
import type { VuePointOptions } from '@vuepoint/core'
import {
  generateSelector,
  describeElement,
  formatAnnotationBatch,
} from '@vuepoint/core'
import { useVueInspector } from '../composables/useVueInspector.js'
import type { AnnotationsStore } from '../composables/useAnnotations.js'
import AnnotationMarker from './AnnotationMarker.vue'
import AnnotationPanel from './AnnotationPanel.vue'

// ─── Props ────────────────────────────────────────────────────────────────────

const props = defineProps<{
  annotationsStore: AnnotationsStore
  options: VuePointOptions & { filterSet: Set<string> }
}>()

// ─── State ────────────────────────────────────────────────────────────────────

type UIMode = 'idle' | 'annotating' | 'panel'

const mode = ref<UIMode>('idle')
const isExpanded = ref(false)
const pendingElement = ref<Element | null>(null)
const feedbackText = ref('')
const expectedText = ref('')
const actualText = ref('')
const showExpectedActual = ref(false)
const hoveredElement = ref<Element | null>(null)

const { getComponentChain, getComponentStores } = useVueInspector({
  filterSet: props.options.filterSet,
})

const annotations = computed(() => props.annotationsStore.annotations.value)
const pendingCount = computed(() => props.annotationsStore.pending.value.length)

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  document.addEventListener('vuepoint:toggle', handleToggle)
})

onUnmounted(() => {
  document.removeEventListener('vuepoint:toggle', handleToggle)
  exitAnnotationMode()
})

// ─── Event handlers ───────────────────────────────────────────────────────────

function handleToggle() {
  if (mode.value === 'annotating') {
    exitAnnotationMode()
  } else {
    enterAnnotationMode()
  }
}

function enterAnnotationMode() {
  mode.value = 'annotating'
  isExpanded.value = true
  document.addEventListener('click', handleDocumentClick, true)
  document.addEventListener('mousemove', handleMouseMove, { passive: true })
  document.body.style.cursor = 'crosshair'
}

function exitAnnotationMode() {
  mode.value = mode.value === 'annotating' ? 'idle' : mode.value
  document.removeEventListener('click', handleDocumentClick, true)
  document.removeEventListener('mousemove', handleMouseMove)
  document.body.style.cursor = ''
  hoveredElement.value = null
  pendingElement.value = null
  feedbackText.value = ''
  expectedText.value = ''
  actualText.value = ''
  showExpectedActual.value = false
}

function handleDocumentClick(e: MouseEvent) {
  const target = e.target as Element

  // Ignore clicks inside VuePoint's own DOM
  if (isVuePointElement(target)) return

  e.preventDefault()
  e.stopPropagation()

  pendingElement.value = target
  mode.value = 'panel'
  exitAnnotationMode()
}

function handleMouseMove(e: MouseEvent) {
  const target = document.elementFromPoint(e.clientX, e.clientY)
  if (target && !isVuePointElement(target)) {
    hoveredElement.value = target
  }
}

function isVuePointElement(el: Element): boolean {
  return !!el.closest('[data-vuepoint="true"]')
}

// ─── Annotation creation ──────────────────────────────────────────────────────

function submitAnnotation() {
  if (!pendingElement.value || !feedbackText.value.trim()) return

  const el = pendingElement.value
  const chain = getComponentChain(el)
  const stores = props.options.pinia?.enabled
    ? getComponentStores(chain, props.options.pinia.instance)
    : undefined

  // Get current route if vue-router is present
  const route = getCurrentRoute()

  props.annotationsStore.create({
    selector: generateSelector(el),
    elementDescription: describeElement(el),
    componentChain: chain,
    piniaStores: stores,
    route,
    feedback: feedbackText.value.trim(),
    expected: expectedText.value.trim() || undefined,
    actual: actualText.value.trim() || undefined,
  })

  feedbackText.value = ''
  expectedText.value = ''
  actualText.value = ''
  showExpectedActual.value = false
  pendingElement.value = null
  mode.value = 'panel'
}

function cancelAnnotation() {
  pendingElement.value = null
  feedbackText.value = ''
  expectedText.value = ''
  actualText.value = ''
  showExpectedActual.value = false
  mode.value = 'idle'
  isExpanded.value = false
}

// ─── Copy all ─────────────────────────────────────────────────────────────────

const copied = ref(false)

async function copyAll() {
  const md = formatAnnotationBatch(annotations.value)
  await navigator.clipboard.writeText(md)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function highlightStyle(el: Element): Record<string, string> {
  const rect = el.getBoundingClientRect()
  return {
    top: `${rect.top + window.scrollY}px`,
    left: `${rect.left + window.scrollX}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
}

function handleMarkerSelect(_id: string) {
  isExpanded.value = true
  mode.value = 'panel'
}

function getCurrentRoute(): string | undefined {
  // Read from vue-router if available on window (non-invasive)
  try {
    const vueAppEl = document.querySelector('[data-v-app]') as Element & {
      __vue_app__?: { config?: { globalProperties?: { $route?: { path: string } } } }
    }
    return vueAppEl?.__vue_app__?.config?.globalProperties?.$route?.path
  } catch {
    return undefined
  }
}
</script>

<template>
  <div data-vuepoint="true" class="vp-root">

    <!-- Hover highlight -->
    <div
      v-if="mode === 'annotating' && hoveredElement"
      class="vp-highlight"
      :style="highlightStyle(hoveredElement)"
    />

    <!-- Annotation markers (numbered badges on annotated elements) -->
    <AnnotationMarker
      v-for="(ann, idx) in annotations"
      :key="ann.id"
      :annotation="ann"
      :index="idx + 1"
      @select="handleMarkerSelect"
    />

    <!-- Feedback input (shown after clicking an element) -->
    <Transition name="vp-fade">
      <div v-if="pendingElement && mode === 'panel'" class="vp-feedback-modal">
        <div class="vp-feedback-header">
          <span class="vp-feedback-selector">{{ generateSelector(pendingElement) }}</span>
          <button class="vp-btn-ghost" @click="cancelAnnotation">✕</button>
        </div>
        <textarea
          v-model="feedbackText"
          class="vp-feedback-input"
          placeholder="Describe the issue or change needed…"
          rows="4"
          autofocus
          @keydown.meta.enter="submitAnnotation"
          @keydown.ctrl.enter="submitAnnotation"
        />
        <button
          class="vp-expand-toggle"
          @click="showExpectedActual = !showExpectedActual"
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
            :class="{ 'vp-chevron--open': showExpectedActual }"
            class="vp-chevron"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          Expected / Actual
        </button>
        <div v-if="showExpectedActual" class="vp-expected-actual">
          <textarea
            v-model="expectedText"
            class="vp-feedback-input vp-feedback-input--sm"
            placeholder="Expected behavior…"
            rows="2"
          />
          <textarea
            v-model="actualText"
            class="vp-feedback-input vp-feedback-input--sm"
            placeholder="Actual behavior…"
            rows="2"
          />
        </div>
        <div class="vp-feedback-actions">
          <span class="vp-hint">⌘↵ to submit</span>
          <button class="vp-btn-secondary" @click="cancelAnnotation">Cancel</button>
          <button
            class="vp-btn-primary"
            :disabled="!feedbackText.trim()"
            @click="submitAnnotation"
          >
            Add Annotation
          </button>
        </div>
      </div>
    </Transition>

    <!-- Annotation list panel -->
    <Transition name="vp-slide">
      <AnnotationPanel
        v-if="isExpanded && mode === 'panel'"
        :store="annotationsStore"
        @close="isExpanded = false; mode = 'idle'"
      />
    </Transition>

    <!-- Toolbar FAB -->
    <div class="vp-toolbar">
      <!-- Annotate button -->
      <button
        class="vp-fab"
        :class="{ 'vp-fab--active': mode === 'annotating' }"
        title="Annotate element (Ctrl+Shift+A)"
        @click="mode === 'annotating' ? exitAnnotationMode() : enterAnnotationMode()"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        <span v-if="mode !== 'annotating'">Annotate</span>
        <span v-else>Cancel</span>
      </button>

      <!-- Badge showing pending count -->
      <button
        v-if="pendingCount > 0"
        class="vp-count-btn"
        :class="{ 'vp-count-btn--active': mode === 'panel' }"
        @click="isExpanded = !isExpanded; mode = isExpanded ? 'panel' : 'idle'"
      >
        {{ pendingCount }}
      </button>

      <!-- Copy all -->
      <button
        v-if="pendingCount > 0"
        class="vp-icon-btn"
        :title="copied ? 'Copied!' : 'Copy all annotations as Markdown'"
        @click="copyAll"
      >
        <svg v-if="!copied" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>
    </div>
  </div>
</template>


<style scoped>
/* ── Reset & scope ───────────────────────────────────────────────────────── */
.vp-root * {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Hover highlight ─────────────────────────────────────────────────────── */
.vp-highlight {
  position: absolute;
  pointer-events: none;
  outline: 2px solid #4f81bd;
  outline-offset: 1px;
  background: rgba(79, 129, 189, 0.08);
  border-radius: 3px;
  z-index: 2147483646;
  transition: all 0.1s ease;
}

/* ── Toolbar FAB ─────────────────────────────────────────────────────────── */
.vp-toolbar {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 2147483647;
}

.vp-fab {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 14px 0 10px;
  background: #1a1a2e;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  transition: background 0.15s, transform 0.1s;
}
.vp-fab:hover { background: #2d2d4e; transform: translateY(-1px); }
.vp-fab--active { background: #4f81bd; border-color: #4f81bd; color: white; }

.vp-count-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.vp-count-btn:hover { background: #dc2626; }
.vp-count-btn--active { background: #4f81bd; }

.vp-icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  color: #94a3b8;
  border: 1px solid #334155;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.vp-icon-btn:hover { color: #e2e8f0; background: #2d2d4e; }

/* ── Feedback modal ──────────────────────────────────────────────────────── */
.vp-feedback-modal {
  position: fixed;
  bottom: 72px;
  right: 20px;
  width: 380px;
  background: #1e1e2e;
  border: 1px solid #334155;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  z-index: 2147483647;
  overflow: hidden;
}

.vp-feedback-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #16213e;
  border-bottom: 1px solid #334155;
  gap: 8px;
}

.vp-feedback-selector {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: #64b5f6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.vp-btn-ghost {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
}
.vp-btn-ghost:hover { color: #e2e8f0; background: #334155; }

.vp-feedback-input {
  width: 100%;
  padding: 12px 14px;
  background: transparent;
  border: none;
  color: #e2e8f0;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
}
.vp-feedback-input::placeholder { color: #4a5568; }

/* ── Expected/Actual toggle ──────────────────────────────────────────── */
.vp-expand-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px 6px;
  background: none;
  border: none;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s;
}
.vp-expand-toggle:hover { color: #94a3b8; }

.vp-chevron {
  transition: transform 0.15s ease;
}
.vp-chevron--open {
  transform: rotate(180deg);
}

.vp-expected-actual {
  border-top: 1px solid #334155;
}

.vp-feedback-input--sm {
  font-size: 12px;
  padding: 8px 14px;
}
.vp-feedback-input--sm + .vp-feedback-input--sm {
  border-top: 1px solid #2d3748;
}

.vp-feedback-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 12px;
}

.vp-hint { font-size: 11px; color: #4a5568; flex: 1; }

.vp-btn-secondary {
  height: 32px;
  padding: 0 12px;
  background: transparent;
  color: #94a3b8;
  border: 1px solid #334155;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.vp-btn-secondary:hover { border-color: #4f81bd; color: #e2e8f0; }

.vp-btn-primary {
  height: 32px;
  padding: 0 14px;
  background: #4f81bd;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.vp-btn-primary:hover:not(:disabled) { background: #3a6fa8; }
.vp-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Transitions ─────────────────────────────────────────────────────────── */
.vp-fade-enter-active, .vp-fade-leave-active { transition: opacity 0.15s; }
.vp-fade-enter-from, .vp-fade-leave-to { opacity: 0; }

.vp-slide-enter-active, .vp-slide-leave-active { transition: transform 0.2s ease, opacity 0.15s; }
.vp-slide-enter-from, .vp-slide-leave-to { transform: translateY(8px); opacity: 0; }
</style>
