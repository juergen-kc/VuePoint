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

import { ref, computed, onMounted, onUnmounted, defineOptions, shallowRef } from 'vue'
import html2canvas from 'html2canvas'

defineOptions({ name: 'VuePointToolbar' })
import type { VuePointOptions, AnnotationElement, AnnotationRect, WebhookDeliveryLog } from '@vuepoint/core'
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

// ─── Theme ────────────────────────────────────────────────────────────────────

type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'vuepoint-theme'

function detectTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

const theme = ref<Theme>(detectTheme())

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(THEME_STORAGE_KEY, theme.value)
}

// ─── State ────────────────────────────────────────────────────────────────────

type UIMode = 'idle' | 'annotating' | 'panel' | 'settings'

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

// ─── Multi-select drag state ──────────────────────────────────────────────────

interface DragRect {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

const isDragging = ref(false)
const dragRect = ref<DragRect | null>(null)
const multiSelectElements = ref<Element[]>([])

// Area selection drag state (Alt+drag)
const isAreaDragging = ref(false)
const areaDragRect = ref<DragRect | null>(null)
const areaRect = ref<AnnotationRect | null>(null)
const areaElements = ref<AnnotationElement[]>([])

// Text selection state
const hasTextSelection = ref(false)
const textSelection = ref<{
  text: string
  containingElement: Element
  rect: AnnotationRect
} | null>(null)

// ─── Webhook delivery log state ─────────────────────────────────────────────

const webhookDeliveries = shallowRef<WebhookDeliveryLog[]>([])
const MAX_UI_DELIVERIES = 50

function handleWebhookDelivery(e: Event) {
  const delivery = (e as CustomEvent<WebhookDeliveryLog>).detail
  webhookDeliveries.value = [delivery, ...webhookDeliveries.value].slice(0, MAX_UI_DELIVERIES)
}

const failedDeliveryCount = computed(
  () => webhookDeliveries.value.filter((d) => !d.success).length
)

async function retryDelivery(delivery: WebhookDeliveryLog) {
  try {
    const res = await fetch('http://127.0.0.1:3742/api/v1/webhooks/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: delivery.id }),
    })
    if (!res.ok) {
      console.error('[VuePoint] Retry failed:', await res.text())
    }
    // The result will arrive via bridge event and update the deliveries list
  } catch (err) {
    console.error('[VuePoint] Retry error:', err)
  }
}

function checkTextSelection() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().trim()) {
    hasTextSelection.value = false
    return
  }
  // Ignore selections inside VuePoint's own UI
  const anchorEl = sel.anchorNode?.parentElement
  if (anchorEl && isVuePointElement(anchorEl)) {
    hasTextSelection.value = false
    return
  }
  hasTextSelection.value = true
}

function captureTextSelection() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return

  const text = sel.toString().trim()
  const range = sel.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  // Find the containing element (common ancestor that is an Element)
  let container = range.commonAncestorContainer
  if (container.nodeType === Node.TEXT_NODE) {
    container = container.parentElement!
  }

  textSelection.value = {
    text,
    containingElement: container as Element,
    rect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    },
  }

  pendingElement.value = container as Element
  mode.value = 'panel'
  isExpanded.value = true

  // Clear the browser selection to avoid confusion
  sel.removeAllRanges()
  hasTextSelection.value = false
}

const selectionRectStyle = computed(() => {
  const rect = isDragging.value ? dragRect.value : areaDragRect.value
  if (!rect) return null
  const { startX, startY, currentX, currentY } = rect
  const left = Math.min(startX, currentX)
  const top = Math.min(startY, currentY)
  const width = Math.abs(currentX - startX)
  const height = Math.abs(currentY - startY)
  return { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }
})

const annotations = computed(() => props.annotationsStore.annotations.value)
const pendingCount = computed(() => props.annotationsStore.pending.value.length)
const questionCount = computed(() => props.annotationsStore.withUnansweredQuestions.value.length)

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  document.addEventListener('vuepoint:toggle', handleToggle)
  document.addEventListener('selectionchange', checkTextSelection)
  document.addEventListener('vuepoint:webhook-delivery', handleWebhookDelivery)
})

onUnmounted(() => {
  document.removeEventListener('vuepoint:toggle', handleToggle)
  document.removeEventListener('selectionchange', checkTextSelection)
  document.removeEventListener('vuepoint:webhook-delivery', handleWebhookDelivery)
  exitAnnotationMode()
  removePauseStyle()
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
  document.addEventListener('mousedown', handleDragStart, true)
  document.body.style.cursor = 'crosshair'
}

function exitAnnotationMode() {
  mode.value = mode.value === 'annotating' ? 'idle' : mode.value
  document.removeEventListener('click', handleDocumentClick, true)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mousedown', handleDragStart, true)
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd, true)
  document.body.style.cursor = ''
  hoveredElement.value = null
  pendingElement.value = null
  isDragging.value = false
  dragRect.value = null
  multiSelectElements.value = []
  isAreaDragging.value = false
  areaDragRect.value = null
  areaRect.value = null
  areaElements.value = []
  textSelection.value = null
  feedbackText.value = ''
  expectedText.value = ''
  actualText.value = ''
  showExpectedActual.value = false
}

function handleDragStart(e: MouseEvent) {
  if (isVuePointElement(e.target as Element)) return
  if (!e.shiftKey && !e.altKey) return

  e.preventDefault()
  e.stopPropagation()

  const rect = { startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY }

  if (e.altKey) {
    // Alt+drag: area selection
    isAreaDragging.value = true
    areaDragRect.value = rect
  } else {
    // Shift+drag: multi-select
    isDragging.value = true
    dragRect.value = rect
  }

  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', handleDragEnd, true)
}

function handleDragMove(e: MouseEvent) {
  if (isDragging.value && dragRect.value) {
    dragRect.value = { ...dragRect.value, currentX: e.clientX, currentY: e.clientY }
  } else if (isAreaDragging.value && areaDragRect.value) {
    areaDragRect.value = { ...areaDragRect.value, currentX: e.clientX, currentY: e.clientY }
  }
}

function handleDragEnd(e: MouseEvent) {
  const isMultiSelect = isDragging.value && dragRect.value
  const isArea = isAreaDragging.value && areaDragRect.value
  if (!isMultiSelect && !isArea) return

  e.preventDefault()
  e.stopPropagation()

  const rect = isMultiSelect ? dragRect.value! : areaDragRect.value!
  const selLeft = Math.min(rect.startX, rect.currentX)
  const selTop = Math.min(rect.startY, rect.currentY)
  const selRight = Math.max(rect.startX, rect.currentX)
  const selBottom = Math.max(rect.startY, rect.currentY)

  // Minimum drag size (10px) to avoid accidental drags
  if (selRight - selLeft < 10 || selBottom - selTop < 10) {
    isDragging.value = false
    dragRect.value = null
    isAreaDragging.value = false
    areaDragRect.value = null
    return
  }

  // Find all leaf elements intersecting the selection rectangle
  const candidates = document.querySelectorAll('body *')
  const captured: Element[] = []

  candidates.forEach((el) => {
    if (isVuePointElement(el)) return
    if (el.children.length > 0) return // prefer leaf elements
    const elRect = el.getBoundingClientRect()
    if (elRect.width === 0 || elRect.height === 0) return
    if (elRect.right >= selLeft && elRect.left <= selRight &&
        elRect.bottom >= selTop && elRect.top <= selBottom) {
      captured.push(el)
    }
  })

  if (isArea) {
    // Alt+drag: area selection
    isAreaDragging.value = false
    areaDragRect.value = null

    // Build the area rect data
    areaRect.value = {
      x: selLeft,
      y: selTop,
      width: selRight - selLeft,
      height: selBottom - selTop,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    }

    // Capture elements within the area as AnnotationElement[]
    areaElements.value = captured.map((el) => ({
      selector: generateSelector(el),
      elementDescription: describeElement(el),
      componentChain: getComponentChain(el),
    }))

    // Use first captured element or create a synthetic pendingElement
    pendingElement.value = captured[0] || document.body
  } else {
    // Shift+drag: multi-select
    isDragging.value = false
    dragRect.value = null

    if (captured.length === 0) return

    multiSelectElements.value = captured
    pendingElement.value = captured[0]
  }

  mode.value = 'panel'
  // Remove listeners — we're now in feedback mode
  document.removeEventListener('click', handleDocumentClick, true)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mousedown', handleDragStart, true)
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd, true)
  document.body.style.cursor = ''
  hoveredElement.value = null
}

function handleDocumentClick(e: MouseEvent) {
  // If Shift or Alt is held, let drag handler handle it
  if (e.shiftKey || e.altKey) return

  const target = e.target as Element

  // Ignore clicks inside VuePoint's own DOM
  if (isVuePointElement(target)) return

  e.preventDefault()
  e.stopPropagation()

  // Capture the element before cleanup — exitAnnotationMode clears pendingElement
  const captured = target
  multiSelectElements.value = []

  // Clean up annotation mode listeners and cursor
  exitAnnotationMode()

  // Restore captured state for the feedback panel
  pendingElement.value = captured
  mode.value = 'panel'
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

// ─── Screenshot capture ──────────────────────────────────────────────────────

const isCapturingScreenshot = ref(false)

async function captureScreenshot(el: Element): Promise<string | undefined> {
  if (!props.options.screenshot?.enabled) return undefined
  try {
    isCapturingScreenshot.value = true
    const canvas = await html2canvas(el as HTMLElement, {
      useCORS: true,
      allowTaint: false,
      scale: window.devicePixelRatio > 1 ? 2 : 1,
      logging: false,
      ignoreElements: (element: Element) => isVuePointElement(element),
    })
    return canvas.toDataURL('image/png')
  } catch {
    // Screenshot capture failed — non-critical, continue without it
    return undefined
  } finally {
    isCapturingScreenshot.value = false
  }
}

// ─── Annotation creation ──────────────────────────────────────────────────────

async function submitAnnotation() {
  if (!pendingElement.value || !feedbackText.value.trim()) return

  const el = pendingElement.value
  const chain = getComponentChain(el)
  const stores = props.options.pinia?.enabled
    ? getComponentStores(el, props.options.pinia.instance)
    : undefined

  // Get current route if vue-router is present
  const route = getCurrentRoute()

  // Build annotation data based on selection type
  let elements: AnnotationElement[] | undefined
  let capturedAreaRect: AnnotationRect | undefined
  let selectedText: string | undefined
  let textSelectionRect: AnnotationRect | undefined
  let selector: string
  let elementDescription: string

  if (textSelection.value) {
    // Text selection annotation
    selectedText = textSelection.value.text
    textSelectionRect = { ...textSelection.value.rect }
    selector = generateSelector(el)
    elementDescription = `Text: "${selectedText.length > 60 ? selectedText.slice(0, 57) + '...' : selectedText}"`
  } else if (areaRect.value) {
    // Alt+drag: area selection
    capturedAreaRect = { ...areaRect.value }
    elements = areaElements.value.length > 0 ? [...areaElements.value] : undefined
    const w = Math.round(capturedAreaRect.width)
    const h = Math.round(capturedAreaRect.height)
    selector = `[area: ${w}×${h} at (${Math.round(capturedAreaRect.x)}, ${Math.round(capturedAreaRect.y)})]`
    elementDescription = `Area selection (${w}×${h})`
  } else if (multiSelectElements.value.length > 1) {
    // Shift+drag: multi-select
    elements = multiSelectElements.value.map((mEl) => ({
      selector: generateSelector(mEl),
      elementDescription: describeElement(mEl),
      componentChain: getComponentChain(mEl),
    }))
    selector = `[multi-select: ${elements.length} elements]`
    elementDescription = `Multi-select (${elements.length} elements)`
  } else {
    // Single element click
    selector = generateSelector(el)
    elementDescription = describeElement(el)
  }

  // Capture screenshot (opt-in — async, non-blocking on failure)
  const screenshot = await captureScreenshot(el)

  props.annotationsStore.create({
    selector,
    elementDescription,
    componentChain: chain,
    elements,
    areaRect: capturedAreaRect,
    selectedText,
    textSelectionRect,
    piniaStores: stores,
    route,
    feedback: feedbackText.value.trim(),
    expected: expectedText.value.trim() || undefined,
    actual: actualText.value.trim() || undefined,
    screenshot,
  })

  feedbackText.value = ''
  expectedText.value = ''
  actualText.value = ''
  showExpectedActual.value = false
  pendingElement.value = null
  multiSelectElements.value = []
  areaRect.value = null
  areaElements.value = []
  textSelection.value = null
  mode.value = 'panel'
}

function cancelAnnotation() {
  pendingElement.value = null
  multiSelectElements.value = []
  areaRect.value = null
  areaElements.value = []
  textSelection.value = null
  feedbackText.value = ''
  expectedText.value = ''
  actualText.value = ''
  showExpectedActual.value = false
  mode.value = 'idle'
  isExpanded.value = false
}

// ─── Animation pause ──────────────────────────────────────────────────────────

const animationsPaused = ref(false)
let pauseStyleEl: HTMLStyleElement | null = null

function toggleAnimationPause() {
  animationsPaused.value = !animationsPaused.value
  if (animationsPaused.value) {
    pauseStyleEl = document.createElement('style')
    pauseStyleEl.setAttribute('data-vuepoint-pause', '')
    pauseStyleEl.textContent = '* { animation-play-state: paused !important; transition: none !important; }'
    document.head.appendChild(pauseStyleEl)
  } else {
    removePauseStyle()
  }
}

function removePauseStyle() {
  if (pauseStyleEl) {
    pauseStyleEl.remove()
    pauseStyleEl = null
  }
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

function handleReplyQuestion(id: string, reply: string) {
  props.annotationsStore.replyToQuestion(id, reply)
}

function formatDeliveryTime(timestamp: string): string {
  try {
    const d = new Date(timestamp)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return timestamp
  }
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
  <div data-vuepoint="true" class="vp-root" :data-vp-theme="theme">

    <!-- Drag selection rectangle (Shift+drag multi-select) -->
    <div
      v-if="isDragging && selectionRectStyle"
      class="vp-selection-rect"
      :style="selectionRectStyle"
    />

    <!-- Area selection rectangle (Alt+drag area select) -->
    <div
      v-if="isAreaDragging && selectionRectStyle"
      class="vp-selection-rect vp-selection-rect--area"
      :style="selectionRectStyle"
    />

    <!-- Hover highlight -->
    <div
      v-if="mode === 'annotating' && !isDragging && hoveredElement"
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
          <span class="vp-feedback-selector">
            {{ textSelection
              ? `Text: "${textSelection.text.length > 40 ? textSelection.text.slice(0, 37) + '...' : textSelection.text}"`
              : areaRect
                ? `Area selection (${Math.round(areaRect.width)}×${Math.round(areaRect.height)})`
                : multiSelectElements.length > 1
                  ? `Multi-select (${multiSelectElements.length} elements)`
                  : generateSelector(pendingElement) }}
          </span>
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
            :disabled="!feedbackText.trim() || isCapturingScreenshot"
            @click="submitAnnotation"
          >
            {{ isCapturingScreenshot ? 'Capturing…' : 'Add Annotation' }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Annotation list panel (hidden while feedback form is active) -->
    <Transition name="vp-slide">
      <AnnotationPanel
        v-if="isExpanded && mode === 'panel' && !pendingElement"
        :store="annotationsStore"
        @close="isExpanded = false; mode = 'idle'"
        @reply-question="handleReplyQuestion"
      />
    </Transition>

    <!-- Webhook delivery log (settings panel) -->
    <Transition name="vp-slide">
      <div v-if="isExpanded && mode === 'settings'" data-vuepoint="true" class="vp-settings-panel">
        <div class="vp-panel-header">
          <span class="vp-panel-title">Webhook Deliveries</span>
          <button class="vp-btn-ghost" title="Close" @click="isExpanded = false; mode = 'idle'">✕</button>
        </div>
        <div v-if="webhookDeliveries.length === 0" class="vp-settings-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a5568" stroke-width="1.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <p>No webhook deliveries yet.</p>
        </div>
        <div v-else class="vp-delivery-list">
          <div
            v-for="d in webhookDeliveries"
            :key="d.id"
            class="vp-delivery-item"
            :class="{ 'vp-delivery-item--failed': !d.success }"
          >
            <div class="vp-delivery-row">
              <span class="vp-delivery-status-dot" :class="d.success ? 'vp-dot--ok' : 'vp-dot--fail'" />
              <span class="vp-delivery-event">{{ d.event }}</span>
              <span v-if="d.statusCode" class="vp-delivery-code" :class="d.success ? '' : 'vp-delivery-code--fail'">{{ d.statusCode }}</span>
              <span v-if="d.retryCount > 0" class="vp-delivery-retry-badge">retry #{{ d.retryCount }}</span>
            </div>
            <div class="vp-delivery-row vp-delivery-row--meta">
              <span class="vp-delivery-url" :title="d.url">{{ d.url }}</span>
              <span class="vp-delivery-time">{{ formatDeliveryTime(d.timestamp) }}</span>
            </div>
            <div v-if="d.error" class="vp-delivery-error">{{ d.error }}</div>
            <button
              v-if="!d.success"
              class="vp-btn-retry"
              @click.stop="retryDelivery(d)"
            >Retry</button>
          </div>
        </div>
      </div>
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

      <!-- Annotate text selection button -->
      <button
        v-if="hasTextSelection && mode !== 'annotating'"
        class="vp-fab vp-fab--text-select"
        title="Annotate selected text"
        @click="captureTextSelection"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M17 18H3"/>
        </svg>
        Annotate Selection
      </button>

      <!-- Pause animations toggle -->
      <button
        class="vp-icon-btn"
        :class="{ 'vp-icon-btn--active': animationsPaused }"
        :title="animationsPaused ? 'Resume animations' : 'Pause animations'"
        @click="toggleAnimationPause"
      >
        <svg v-if="!animationsPaused" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </button>

      <!-- Theme toggle -->
      <button
        class="vp-icon-btn"
        :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      >
        <!-- Sun icon (shown in dark mode → click to go light) -->
        <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <!-- Moon icon (shown in light mode → click to go dark) -->
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
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

      <!-- Agent question badge -->
      <button
        v-if="questionCount > 0"
        class="vp-question-btn"
        title="Agent questions need your reply"
        @click="isExpanded = true; mode = 'panel'"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        {{ questionCount }}
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

      <!-- Webhook settings -->
      <button
        class="vp-icon-btn"
        :class="{ 'vp-icon-btn--active': mode === 'settings', 'vp-icon-btn--alert': failedDeliveryCount > 0 }"
        title="Webhook deliveries"
        @click="mode = mode === 'settings' ? 'idle' : 'settings'; isExpanded = mode === 'settings'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <span v-if="failedDeliveryCount > 0" class="vp-failed-badge">{{ failedDeliveryCount }}</span>
      </button>
    </div>
  </div>
</template>


<style scoped>
/* ── Theme tokens (dark = default) ───────────────────────────────────────── */
.vp-root {
  --vp-bg: #1e1e2e;
  --vp-bg-elevated: #1a1a2e;
  --vp-bg-header: #16213e;
  --vp-bg-hover: #2d2d4e;
  --vp-border: #334155;
  --vp-border-subtle: #2d3748;
  --vp-text: #e2e8f0;
  --vp-text-muted: #94a3b8;
  --vp-text-faint: #64748b;
  --vp-text-hint: #4a5568;
  --vp-accent: #4f81bd;
  --vp-accent-hover: #3a6fa8;
  --vp-code: #64b5f6;
  --vp-shadow: rgba(0, 0, 0, 0.4);
  --vp-shadow-fab: rgba(0, 0, 0, 0.3);
  --vp-highlight-border: #4f81bd;
  --vp-highlight-bg: rgba(79, 129, 189, 0.08);
}

.vp-root[data-vp-theme="light"] {
  --vp-bg: #ffffff;
  --vp-bg-elevated: #f8fafc;
  --vp-bg-header: #f1f5f9;
  --vp-bg-hover: #e2e8f0;
  --vp-border: #cbd5e1;
  --vp-border-subtle: #e2e8f0;
  --vp-text: #1e293b;
  --vp-text-muted: #475569;
  --vp-text-faint: #64748b;
  --vp-text-hint: #94a3b8;
  --vp-accent: #4f81bd;
  --vp-accent-hover: #3a6fa8;
  --vp-code: #2563eb;
  --vp-shadow: rgba(0, 0, 0, 0.12);
  --vp-shadow-fab: rgba(0, 0, 0, 0.15);
  --vp-highlight-border: #4f81bd;
  --vp-highlight-bg: rgba(79, 129, 189, 0.12);
}

/* ── Reset & scope ───────────────────────────────────────────────────────── */
.vp-root * {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Drag selection rectangle ────────────────────────────────────────────── */
.vp-selection-rect {
  position: fixed;
  pointer-events: none;
  border: 2px dashed var(--vp-accent);
  background: rgba(79, 129, 189, 0.12);
  border-radius: 3px;
  z-index: 2147483646;
}

/* Area selection variant — distinct orange dashed border */
.vp-selection-rect--area {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.10);
}

/* ── Hover highlight ─────────────────────────────────────────────────────── */
.vp-highlight {
  position: absolute;
  pointer-events: none;
  outline: 2px solid var(--vp-highlight-border);
  outline-offset: 1px;
  background: var(--vp-highlight-bg);
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
  background: var(--vp-bg-elevated);
  color: var(--vp-text);
  border: 1px solid var(--vp-border);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 12px var(--vp-shadow-fab);
  transition: background 0.15s, transform 0.1s;
}
.vp-fab:hover { background: var(--vp-bg-hover); transform: translateY(-1px); }
.vp-fab--active { background: var(--vp-accent); border-color: var(--vp-accent); color: white; }
.vp-fab--text-select { background: #7c3aed; border-color: #7c3aed; color: white; font-size: 12px; }
.vp-fab--text-select:hover { background: #6d28d9; transform: translateY(-1px); }

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
.vp-count-btn--active { background: var(--vp-accent); }

.vp-question-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
  animation: vp-pulse 2s ease-in-out infinite;
}
.vp-question-btn:hover { background: #d97706; }

@keyframes vp-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
}

.vp-icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-bg-elevated);
  color: var(--vp-text-muted);
  border: 1px solid var(--vp-border);
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.vp-icon-btn:hover { color: var(--vp-text); background: var(--vp-bg-hover); }
.vp-icon-btn--active { color: #f59e0b; border-color: #f59e0b; }

/* ── Feedback modal ──────────────────────────────────────────────────────── */
.vp-feedback-modal {
  position: fixed;
  bottom: 72px;
  right: 20px;
  width: 380px;
  background: var(--vp-bg);
  border: 1px solid var(--vp-border);
  border-radius: 12px;
  box-shadow: 0 8px 32px var(--vp-shadow);
  z-index: 2147483647;
  overflow: hidden;
}

.vp-feedback-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--vp-bg-header);
  border-bottom: 1px solid var(--vp-border);
  gap: 8px;
}

.vp-feedback-selector {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: var(--vp-code);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.vp-btn-ghost {
  background: none;
  border: none;
  color: var(--vp-text-faint);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
}
.vp-btn-ghost:hover { color: var(--vp-text); background: var(--vp-border); }

.vp-feedback-input {
  width: 100%;
  padding: 12px 14px;
  background: transparent;
  border: none;
  color: var(--vp-text);
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
}
.vp-feedback-input::placeholder { color: var(--vp-text-hint); }

/* ── Expected/Actual toggle ──────────────────────────────────────────── */
.vp-expand-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px 6px;
  background: none;
  border: none;
  color: var(--vp-text-faint);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s;
}
.vp-expand-toggle:hover { color: var(--vp-text-muted); }

.vp-chevron {
  transition: transform 0.15s ease;
}
.vp-chevron--open {
  transform: rotate(180deg);
}

.vp-expected-actual {
  border-top: 1px solid var(--vp-border);
}

.vp-feedback-input--sm {
  font-size: 12px;
  padding: 8px 14px;
}
.vp-feedback-input--sm + .vp-feedback-input--sm {
  border-top: 1px solid var(--vp-border-subtle);
}

.vp-feedback-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 12px;
}

.vp-hint { font-size: 11px; color: var(--vp-text-hint); flex: 1; }

.vp-btn-secondary {
  height: 32px;
  padding: 0 12px;
  background: transparent;
  color: var(--vp-text-muted);
  border: 1px solid var(--vp-border);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.vp-btn-secondary:hover { border-color: var(--vp-accent); color: var(--vp-text); }

.vp-btn-primary {
  height: 32px;
  padding: 0 14px;
  background: var(--vp-accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.vp-btn-primary:hover:not(:disabled) { background: var(--vp-accent-hover); }
.vp-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Webhook settings icon alert ──────────────────────────────────────────── */
.vp-icon-btn--alert {
  position: relative;
  color: #ef4444;
  border-color: #ef4444;
}

.vp-failed-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: #ef4444;
  color: white;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* ── Settings panel (webhook delivery log) ───────────────────────────────── */
.vp-settings-panel {
  position: fixed;
  bottom: 72px;
  right: 20px;
  width: 420px;
  max-height: 420px;
  background: var(--vp-bg);
  border: 1px solid var(--vp-border);
  border-radius: 12px;
  box-shadow: 0 8px 32px var(--vp-shadow);
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.vp-settings-panel .vp-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--vp-bg-header);
  border-bottom: 1px solid var(--vp-border);
  flex-shrink: 0;
}

.vp-settings-panel .vp-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-text);
}

.vp-settings-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 20px;
  color: var(--vp-text-faint);
  text-align: center;
}
.vp-settings-empty p {
  margin: 0;
  font-size: 13px;
}

.vp-delivery-list {
  overflow-y: auto;
  flex: 1;
  padding: 4px 0;
}
.vp-delivery-list::-webkit-scrollbar { width: 4px; }
.vp-delivery-list::-webkit-scrollbar-thumb { background: var(--vp-border); border-radius: 4px; }

.vp-delivery-item {
  padding: 8px 14px;
  border-bottom: 1px solid var(--vp-border-subtle);
  transition: background 0.1s;
}
.vp-delivery-item:hover { background: var(--vp-bg-hover); }
.vp-delivery-item--failed {
  background: rgba(239, 68, 68, 0.06);
}
.vp-delivery-item--failed:hover {
  background: rgba(239, 68, 68, 0.1);
}

.vp-delivery-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.vp-delivery-row--meta {
  margin-top: 3px;
  font-size: 11px;
}

.vp-delivery-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.vp-dot--ok { background: #22c55e; }
.vp-dot--fail { background: #ef4444; }

.vp-delivery-event {
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vp-delivery-code {
  font-size: 11px;
  font-weight: 600;
  color: #22c55e;
  font-family: 'Courier New', monospace;
}
.vp-delivery-code--fail {
  color: #ef4444;
}

.vp-delivery-retry-badge {
  font-size: 10px;
  font-weight: 500;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
  padding: 1px 5px;
  border-radius: 4px;
}

.vp-delivery-url {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: var(--vp-text-muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vp-delivery-time {
  font-size: 10px;
  color: var(--vp-text-hint);
  flex-shrink: 0;
}

.vp-delivery-error {
  margin-top: 3px;
  font-size: 11px;
  color: #ef4444;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vp-btn-retry {
  margin-top: 4px;
  height: 22px;
  padding: 0 8px;
  background: transparent;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.vp-btn-retry:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
}

/* ── Transitions ─────────────────────────────────────────────────────────── */
.vp-fade-enter-active, .vp-fade-leave-active { transition: opacity 0.15s; }
.vp-fade-enter-from, .vp-fade-leave-to { opacity: 0; }

.vp-slide-enter-active, .vp-slide-leave-active { transition: transform 0.2s ease, opacity 0.15s; }
.vp-slide-enter-from, .vp-slide-leave-to { transform: translateY(8px); opacity: 0; }
</style>
