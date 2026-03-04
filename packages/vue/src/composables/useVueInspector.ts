/**
 * useVueInspector.ts
 *
 * Walks the Vue 3 internal component instance tree to resolve the real
 * component hierarchy for any DOM element — the Vue equivalent of
 * Agentation's React fiber tree walk.
 *
 * How it works:
 *   Vue 3 attaches `__vueParentComponent` to DOM elements in dev builds.
 *   This is the same property Vue DevTools uses to build its component tree.
 *   We walk from the clicked element up to the app root, collecting component
 *   names and SFC file paths along the way.
 *
 * Output example for a click on a PButton inside UserToolbar inside UserManagementView:
 *   [
 *     { name: 'App',                   file: 'src/App.vue' },
 *     { name: 'UserManagementView',    file: 'src/views/users/UserManagementView.vue' },
 *     { name: 'UserToolbar',           file: 'src/components/users/UserToolbar.vue' },
 *     { name: 'PButton',               file: undefined },  ← filtered out by default
 *   ]
 *
 * Requirements:
 *   - Vue 3 dev build (production builds strip __vueParentComponent)
 *   - No Vue DevTools extension required — works via internal DOM property
 */

import type { VueComponentInfo } from '@vuepoint/core'

// ─── Vue 3 internal types (subset we actually use) ───────────────────────────
// We avoid importing from @vue/runtime-core to keep the dep footprint minimal.
// These types reflect the actual shape at runtime — validated against Vue 3.4+.

interface VueInternalInstance {
  type: {
    /** Set by <script setup> via compiler — matches the filename */
    __name?: string
    /** Set via defineComponent({ name: '...' }) */
    name?: string
    /** Absolute path set by Vite/webpack vue-loader in dev builds */
    __file?: string
  }
  /** Parent component instance — null at app root */
  parent: VueInternalInstance | null
  /** Props reactive object */
  props: Record<string, unknown>
  /** App context — used to detect app root */
  appContext: unknown
}

// ─── Augment Element for the Vue internal property ───────────────────────────

declare global {
  interface Element {
    /** Vue 3 attaches this in dev builds */
    __vueParentComponent?: VueInternalInstance
  }
}

// ─── Composable ──────────────────────────────────────────────────────────────

export interface UseVueInspectorOptions {
  /** Component names to exclude. Built from VuePointOptions.filterComponents. */
  filterSet: Set<string>
  /** Whether to include prop keys in the output (keys only — no values). */
  includeProps?: boolean
}

export function useVueInspector(options: UseVueInspectorOptions) {
  /**
   * Resolves the Vue component hierarchy for a given DOM element.
   * Returns an ordered array from app root → most specific component.
   * Returns an empty array if the element is not inside a Vue app
   * or if running in a production build.
   */
  function getComponentChain(el: Element): VueComponentInfo[] {
    // Walk up the DOM to find the nearest element with the Vue instance attached.
    // The property may be on the element itself or a parent.
    let domEl: Element | null = el
    let startInstance: VueInternalInstance | null = null

    while (domEl && !startInstance) {
      if (domEl.__vueParentComponent) {
        startInstance = domEl.__vueParentComponent
      }
      domEl = domEl.parentElement
    }

    if (!startInstance) {
      // Production build or non-Vue element — graceful degradation
      return []
    }

    // Walk up the instance tree, collecting component info
    const chain: VueComponentInfo[] = []
    let instance: VueInternalInstance | null = startInstance

    while (instance) {
      const info = extractComponentInfo(instance, options)
      if (info) chain.push(info)
      instance = instance.parent
    }

    // Reverse so the chain reads App → ... → LeafComponent
    chain.reverse()

    return chain
  }

  /**
   * Returns Pinia store IDs that are currently active in the app.
   * Only used when Pinia opt-in is enabled.
   *
   * We read from the Pinia instance passed in options rather than importing
   * Pinia directly — this keeps Pinia as a true optional peer dep.
   */
  function getPiniaStoreIds(piniaInstance: unknown): string[] {
    try {
      // Pinia exposes _s (a Map of storeId → store) on its instance
      const pinia = piniaInstance as { _s?: Map<string, unknown> }
      if (!pinia._s) return []
      return Array.from(pinia._s.keys())
    } catch {
      return []
    }
  }

  /**
   * Returns Pinia store IDs that a specific component instance accesses.
   * This is best-effort — we check if the component's setup result contains
   * any reactive properties that share IDs with known stores.
   */
  function getComponentStores(
    chain: VueComponentInfo[],
    piniaInstance: unknown
  ): string[] {
    if (!piniaInstance) return []
    // For now, return all active store IDs for the leaf component.
    // A more precise implementation would inspect setupState bindings —
    // left as a Phase 2 enhancement.
    return getPiniaStoreIds(piniaInstance)
  }

  return {
    getComponentChain,
    getComponentStores,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractComponentInfo(
  instance: VueInternalInstance,
  options: UseVueInspectorOptions
): VueComponentInfo | null {
  const { type, props } = instance

  // Resolve the component name using the same priority as Vue DevTools:
  //   1. __name — set by the Vue compiler for <script setup> components
  //   2. name   — set via defineComponent({ name: '...' })
  //   3. __file — SFC filename, used as last resort (strip path and extension)
  const name =
    type.__name ||
    type.name ||
    filenameToName(type.__file)

  // Skip anonymous components and filtered internals
  if (!name || options.filterSet.has(name)) return null

  const info: VueComponentInfo = { name }

  // SFC file path — strip any absolute prefix to get a project-relative path
  if (type.__file) {
    info.file = normalizePath(type.__file)
  }

  // Prop keys — no values to avoid leaking sensitive data
  if (options.includeProps) {
    const keys = Object.keys(props).filter((k) => !k.startsWith('__'))
    if (keys.length > 0) info.propKeys = keys
  }

  return info
}

/** Extracts a PascalCase component name from an SFC file path */
function filenameToName(file?: string): string | undefined {
  if (!file) return undefined
  const base = file.split('/').pop()?.replace(/\.vue$/, '')
  return base || undefined
}

/**
 * Normalises an absolute file path to a project-relative one.
 * Handles both /Users/juergen/projects/app/src/... and
 * C:\Users\juergen\projects\app\src\... paths.
 */
function normalizePath(file: string): string {
  // Find the src/ segment and return from there
  const srcIdx = file.indexOf('/src/')
  if (srcIdx !== -1) return file.slice(srcIdx + 1) // → src/...

  // Fallback: just the last 3 path segments
  const parts = file.replace(/\\/g, '/').split('/')
  return parts.slice(-3).join('/')
}
