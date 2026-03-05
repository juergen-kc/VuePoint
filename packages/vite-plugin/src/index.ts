import type { Plugin, ResolvedConfig } from 'vite'
import type { VuePointOptions } from '@vuepoint/core'

export interface VitePluginVuePointOptions extends VuePointOptions {
  /**
   * Entry file glob pattern to detect. The plugin transforms the first file
   * matching this pattern that also contains a `createApp` call.
   * @default /\/(main|entry|app)\.(ts|js|mts|mjs)$/
   */
  entry?: RegExp
}

const DEFAULT_ENTRY_RE = /\/(main|entry|app)\.(ts|js|mts|mjs)$/

/**
 * Vite plugin that auto-injects VuePoint into a Vue 3 app.
 *
 * Add to `vite.config.ts` — no `main.ts` changes needed:
 * ```ts
 * import vuePoint from 'vite-plugin-vuepoint'
 * export default defineConfig({
 *   plugins: [vue(), vuePoint()],
 * })
 * ```
 */
export default function vuePointPlugin(
  options: VitePluginVuePointOptions = {},
): Plugin {
  const { entry: entryPattern = DEFAULT_ENTRY_RE, ...vuepointOptions } = options
  let config: ResolvedConfig
  let injected = false

  return {
    name: 'vite-plugin-vuepoint',

    // Only apply during dev serve — production builds skip VuePoint entirely
    apply: 'serve',

    configResolved(resolvedConfig) {
      config = resolvedConfig
    },

    // Reset injection flag when Vite re-optimizes deps and triggers a full reload
    buildStart() {
      injected = false
    },

    transform(code, id) {
      // Skip node_modules
      if (id.includes('node_modules')) return null

      // Skip if already injected (only inject once)
      if (injected) return null

      // Check if this looks like the app entry file
      if (!entryPattern.test(id)) return null

      // Must contain createApp call
      const createAppRe = /(?:const|let|var)\s+(\w+)\s*=\s*createApp\s*\(/
      const match = code.match(createAppRe)
      if (!match) return null

      const appVarName = match[1]

      // Must have a .mount( call for this variable
      const mountRe = new RegExp(`${appVarName}\\.mount\\s*\\(`)
      const mountMatch = mountRe.exec(code)
      if (!mountMatch) return null

      injected = true

      // Build options string for the .use() call
      const optionsStr = Object.keys(vuepointOptions).length > 0
        ? `, ${JSON.stringify(vuepointOptions)}`
        : ''

      // Inject import at the top of the file
      const importLine = `import { VuePoint as __VuePoint__ } from '@vuepoint/vue'\n`

      // Inject app.use() right before .mount()
      const mountIndex = mountMatch.index!
      const useLine = `${appVarName}.use(__VuePoint__${optionsStr})\n`

      const newCode =
        importLine +
        code.slice(0, mountIndex) +
        useLine +
        code.slice(mountIndex)

      if (config.command === 'serve') {
        config.logger.info(
          `[vite-plugin-vuepoint] Injected VuePoint into ${id.split('/').pop()}`,
        )
      }

      return { code: newCode, map: null }
    },
  }
}

export type { VuePointOptions } from '@vuepoint/core'
