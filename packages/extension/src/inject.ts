/**
 * inject.ts — Page-context injection script (world: MAIN)
 *
 * Runs in the host page's JavaScript context. Detects the Vue 3 app
 * instance and installs VuePoint onto it.
 *
 * This script is self-contained — it bundles VuePoint and its own Vue
 * copy for the isolated toolbar app. It reads the host app's Vue
 * internals (__vueParentComponent, __vue_app__) for component hierarchy
 * resolution, which are available on DOM elements regardless of the
 * Vue runtime copy used.
 */

import type { VuePointOptions } from '@vuepoint/core'
import { buildFilter } from '@vuepoint/core'
import { useAnnotationsStore } from '@vuepoint/vue'
import VuePointToolbar from '../../vue/src/components/VuePointToolbar.vue'
import { createBridgeClient } from '@vuepoint/bridge'
import type { BridgeEvent, AppContext } from '@vuepoint/bridge'
import { createApp, nextTick } from 'vue'

/** Guard: only run once */
if (!(window as unknown as Record<string, unknown>).__VUEPOINT_INJECTED__) {
  ;(window as unknown as Record<string, unknown>).__VUEPOINT_INJECTED__ = true

  const VUE_ROOT_SELECTORS = ['#app', '#__nuxt', '[data-v-app]', '#root']

  /** Find the Vue 3 app root element */
  function findVueRoot(): HTMLElement | null {
    for (const selector of VUE_ROOT_SELECTORS) {
      const el = document.querySelector(selector) as HTMLElement | null
      if (el && '__vue_app__' in el) {
        return el
      }
    }
    for (const child of document.body.children) {
      if ('__vue_app__' in child) {
        return child as unknown as HTMLElement
      }
    }
    return null
  }

  /** Extract component name from __file path */
  function fileToName(file?: string): string | undefined {
    if (!file) return undefined
    const base = file.split('/').pop() ?? file
    return base.replace(/\.vue$/, '')
  }

  let settings: { mcpPort: number; apiPort: number; authToken: string } = {
    mcpPort: 3742,
    apiPort: 3742,
    authToken: '',
  }

  // Listen for settings from the extension
  window.addEventListener('vuepoint-ext:configure', ((e: CustomEvent) => {
    settings = { ...settings, ...e.detail }
  }) as EventListener)

  function installVuePoint(): void {
    const rootEl = findVueRoot()
    if (!rootEl) {
      console.warn('[VuePoint Extension] No Vue 3 app found on page.')
      return
    }

    // Access the host app's Vue instance for context resolution
    const hostApp = (rootEl as unknown as Record<string, unknown>).__vue_app__ as {
      config: {
        globalProperties: Record<string, unknown>
      }
    } | undefined

    const options: VuePointOptions = {
      enabled: true,
      shortcut: 'ctrl+shift+a',
      mcp: { enabled: true, port: settings.mcpPort, authToken: settings.authToken || undefined },
      api: { enabled: true, port: settings.apiPort, authToken: settings.authToken || undefined },
    }

    const filterSet = buildFilter(options.filterComponents)
    const annotationsStore = useAnnotationsStore()

    // ── Bridge sync ───────────────────────────────────────────────────────
    const bridge = createBridgeClient()
    bridge.connect()

    const origCreate = annotationsStore.create.bind(annotationsStore)
    const origUpdate = annotationsStore.update.bind(annotationsStore)
    const origRemove = annotationsStore.remove.bind(annotationsStore)
    const origClear = annotationsStore.clear.bind(annotationsStore)
    const origReplyToQuestion = annotationsStore.replyToQuestion.bind(annotationsStore)

    const patchedStore = annotationsStore as typeof annotationsStore & { _bridgeSyncing?: boolean }

    Object.assign(annotationsStore, {
      create: (input: Parameters<typeof origCreate>[0]) => {
        const ann = origCreate(input)
        if (!patchedStore._bridgeSyncing) bridge.syncAnnotation(ann)
        return ann
      },
      update: (id: string, patch: Parameters<typeof origUpdate>[1]) => {
        const result = origUpdate(id, patch)
        if (result && !patchedStore._bridgeSyncing) bridge.updateAnnotation(id, patch)
        return result
      },
      remove: (id: string) => {
        const result = origRemove(id)
        if (result && !patchedStore._bridgeSyncing) bridge.removeAnnotation(id)
        return result
      },
      clear: () => {
        origClear()
        if (!patchedStore._bridgeSyncing) bridge.clearAnnotations()
      },
      replyToQuestion: (id: string, reply: string) => {
        const result = origReplyToQuestion(id, reply)
        if (result && !patchedStore._bridgeSyncing) bridge.replyQuestion(id, reply)
        return result
      },
    })

    bridge.onEvent((event: BridgeEvent) => {
      patchedStore._bridgeSyncing = true
      try {
        switch (event.type) {
          case 'state':
            annotationsStore.replaceAll(event.annotations)
            break
          case 'annotation_created':
            annotationsStore.addFromBridge(event.annotation)
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
          case 'webhook_delivery':
            document.dispatchEvent(
              new CustomEvent('vuepoint:webhook-delivery', { detail: event.delivery })
            )
            break
        }
      } finally {
        patchedStore._bridgeSyncing = false
      }
    })

    // ── Context sync ──────────────────────────────────────────────────────
    nextTick(() => {
      if (!hostApp) return

      const router = hostApp.config.globalProperties.$router as
        | {
            currentRoute: {
              value: {
                path?: string
                name?: string | symbol
                matched?: Array<{
                  components?: Record<string, { name?: string; __name?: string; __file?: string }>
                }>
              }
            }
            afterEach: (guard: () => void) => () => void
          }
        | undefined

      const pinia = hostApp.config.globalProperties.$pinia as
        | { _s?: Map<string, unknown> }
        | undefined

      function buildContext(): AppContext {
        const ctx: AppContext = {}
        if (router) {
          const route = router.currentRoute.value
          ctx.route = route.path
          ctx.routeName = typeof route.name === 'string' ? route.name : undefined
          if (route.matched?.length) {
            const deepest = route.matched[route.matched.length - 1]
            const comp = deepest.components?.default as
              | { name?: string; __name?: string; __file?: string }
              | undefined
            if (comp) {
              ctx.pageComponent = comp.__name ?? comp.name ?? fileToName(comp.__file)
            }
          }
        }
        if (pinia?._s) {
          ctx.piniaStores = Array.from(pinia._s.keys())
        }
        return ctx
      }

      bridge.updateContext(buildContext())

      if (router) {
        router.afterEach(() => {
          bridge.updateContext(buildContext())
        })
      }
    })

    // ── Mount toolbar ─────────────────────────────────────────────────────
    const mountPoint = document.createElement('div')
    mountPoint.id = '__vuepoint-root'
    mountPoint.setAttribute('data-vuepoint', 'true')
    document.body.appendChild(mountPoint)

    const toolbarApp = createApp(VuePointToolbar, {
      annotationsStore,
      options: { ...options, filterSet },
    })
    toolbarApp.mount(mountPoint)

    // ── Keyboard shortcut ─────────────────────────────────────────────────
    const shortcut = options.shortcut ?? 'ctrl+shift+a'
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
        document.dispatchEvent(new CustomEvent('vuepoint:toggle'))
      }
    })

    console.info(
      '[VuePoint Extension] Injected successfully. ' +
      `Shortcut: ${shortcut}. ` +
      `MCP port: ${settings.mcpPort}. ` +
      `API port: ${settings.apiPort}.`
    )
  }

  // Run after a short delay to ensure page is ready
  if (document.readyState === 'complete') {
    setTimeout(installVuePoint, 100)
  } else {
    window.addEventListener('load', () => setTimeout(installVuePoint, 100))
  }
}
