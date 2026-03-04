/**
 * plugin.ts
 *
 * VuePoint Vue 3 plugin. Register with:
 *   app.use(VuePoint)
 *   app.use(VuePoint, { shortcut: 'ctrl+shift+v', pinia: { enabled: true, instance: pinia } })
 *
 * The plugin:
 *   1. Guards against production builds — no-ops silently if disabled
 *   2. Provides annotation store to the entire app via inject
 *   3. Mounts the toolbar overlay component
 *   4. Starts MCP/API servers if configured (via postMessage to SharedWorker)
 */

import type { App, Plugin } from 'vue'
import type { VuePointOptions } from '@vuepoint/core'
import { buildFilter } from '@vuepoint/core'
import { useAnnotationsStore, VUEPOINT_ANNOTATIONS_KEY } from './composables/useAnnotations.js'
import { createBridgeClient } from '@vuepoint/bridge'
import type { BridgeEvent } from '@vuepoint/bridge'
import VuePointToolbar from './components/VuePointToolbar.vue'

export const VUEPOINT_OPTIONS_KEY = Symbol('vuepoint:options')
export const VUEPOINT_INSPECTOR_KEY = Symbol('vuepoint:inspector')

const VuePoint: Plugin<VuePointOptions | undefined> = {
  install(app: App, options: VuePointOptions = {}) {
    // ── Production guard ──────────────────────────────────────────────────
    const enabled = options.enabled ?? (
      typeof process !== 'undefined'
        ? process.env.NODE_ENV !== 'production'
        : !import.meta.env?.PROD
    )

    if (!enabled) return

    // ── Warn if attached to production Vue instance ────────────────────────
    // __vueParentComponent is stripped in prod builds — annotations will be
    // selector-only without component hierarchy. Surface this clearly.
    if (!(window as unknown as Record<string, unknown>).__VUE__) {
      console.warn(
        '[VuePoint] Vue 3 dev build not detected. ' +
        'Component hierarchy resolution will be unavailable. ' +
        'Ensure VuePoint is only loaded in development/staging builds.'
      )
    }

    // ── Build component filter set ────────────────────────────────────────
    const filterSet = buildFilter(options.filterComponents)

    // ── Annotation store ──────────────────────────────────────────────────
    const annotationsStore = useAnnotationsStore()

    app.provide(VUEPOINT_ANNOTATIONS_KEY, annotationsStore)
    app.provide(VUEPOINT_OPTIONS_KEY, { ...options, filterSet })

    // ── Bridge — multi-tab sync + API server ──────────────────────────────
    const bridge = createBridgeClient()
    bridge.connect()

    // Forward local annotation events to the bridge
    const origCreate = annotationsStore.create.bind(annotationsStore)
    const origUpdate = annotationsStore.update.bind(annotationsStore)
    const origRemove = annotationsStore.remove.bind(annotationsStore)
    const origClear = annotationsStore.clear.bind(annotationsStore)

    // Monkey-patch store methods to sync to bridge
    // Using Object.assign to extend the store with bridge-aware versions
    const patchedStore = annotationsStore as typeof annotationsStore & { _bridgeSyncing?: boolean }

    const wrappedCreate: typeof origCreate = (input) => {
      const ann = origCreate(input)
      if (!patchedStore._bridgeSyncing) {
        bridge.syncAnnotation(ann)
      }
      return ann
    }

    const wrappedUpdate: typeof origUpdate = (id, patch) => {
      const result = origUpdate(id, patch)
      if (result && !patchedStore._bridgeSyncing) {
        bridge.updateAnnotation(id, patch)
      }
      return result
    }

    const wrappedRemove: typeof origRemove = (id) => {
      const result = origRemove(id)
      if (result && !patchedStore._bridgeSyncing) {
        bridge.removeAnnotation(id)
      }
      return result
    }

    const wrappedClear: typeof origClear = () => {
      origClear()
      if (!patchedStore._bridgeSyncing) {
        bridge.clearAnnotations()
      }
    }

    // Apply wrapped methods
    Object.assign(annotationsStore, {
      create: wrappedCreate,
      update: wrappedUpdate,
      remove: wrappedRemove,
      clear: wrappedClear,
    })

    // Listen for events from other tabs via bridge
    bridge.onEvent((event: BridgeEvent) => {
      patchedStore._bridgeSyncing = true
      try {
        switch (event.type) {
          case 'annotation_created':
            // Only add if we don't already have it (came from another tab)
            if (!annotationsStore.getById(event.annotation.id)) {
              origCreate({
                selector: event.annotation.selector,
                elementDescription: event.annotation.elementDescription,
                componentChain: event.annotation.componentChain,
                feedback: event.annotation.feedback,
                piniaStores: event.annotation.piniaStores,
                route: event.annotation.route,
                expected: event.annotation.expected,
                actual: event.annotation.actual,
              })
            }
            break
          case 'annotation_updated':
            origUpdate(event.annotation.id, event.annotation)
            break
          case 'annotation_removed':
            origRemove(event.id)
            break
          case 'annotations_cleared':
            origClear()
            break
        }
      } finally {
        patchedStore._bridgeSyncing = false
      }
    })

    // ── Mount toolbar overlay ─────────────────────────────────────────────
    // We create a separate app instance for the toolbar to fully isolate
    // VuePoint's own component tree from the host app. This prevents our
    // components from appearing in the host app's __vueParentComponent chain.
    const mountPoint = document.createElement('div')
    mountPoint.id = '__vuepoint-root'
    mountPoint.setAttribute('data-vuepoint', 'true')
    document.body.appendChild(mountPoint)

    const toolbarApp = createToolbarApp(VuePointToolbar, {
      annotationsStore,
      options: { ...options, filterSet },
    })
    toolbarApp.mount(mountPoint)

    // ── Keyboard shortcut ─────────────────────────────────────────────────
    const shortcut = options.shortcut ?? 'ctrl+shift+a'
    registerShortcut(shortcut, () => {
      // Toolbar component listens to this event to toggle
      document.dispatchEvent(new CustomEvent('vuepoint:toggle'))
    })

    // Log successful init
    console.info(
      '[VuePoint] Initialized. ' +
      `Shortcut: ${shortcut}. ` +
      (options.mcp?.enabled ? `MCP: port ${options.mcp.port ?? 3741}. ` : '') +
      (options.api?.enabled ? `API: port ${options.api.port ?? 3742}.` : '')
    )
  },
}

export { VuePoint }
export default VuePoint

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { createApp, defineComponent, h } from 'vue'
import type { AnnotationsStore } from './composables/useAnnotations.js'

function createToolbarApp(
  component: ReturnType<typeof defineComponent>,
  props: { annotationsStore: AnnotationsStore; options: VuePointOptions & { filterSet: Set<string> } }
) {
  // Isolated Vue app for the toolbar — does not share provide/inject with host
  return createApp(component, props)
}

function registerShortcut(shortcut: string, cb: () => void): void {
  // Parse shortcut like "ctrl+shift+a" or "meta+shift+v"
  const parts = shortcut.toLowerCase().split('+')
  const key = parts.at(-1)!
  const ctrl = parts.includes('ctrl')
  const meta = parts.includes('meta') || parts.includes('cmd')
  const shift = parts.includes('shift')
  const alt = parts.includes('alt')

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (
      e.key.toLowerCase() === key &&
      e.ctrlKey === ctrl &&
      e.metaKey === meta &&
      e.shiftKey === shift &&
      e.altKey === alt
    ) {
      e.preventDefault()
      cb()
    }
  })
}
