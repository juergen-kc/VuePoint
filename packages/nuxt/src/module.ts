import { defineNuxtModule, addPlugin, createResolver } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import type { VuePointOptions } from '@vuepoint/core'

export interface ModuleOptions {
  /** Master enable/disable. Default: auto-disabled in production. */
  enabled?: boolean
  /** Component names to exclude from the hierarchy chain. */
  filterComponents?: string[] | false
  /** Keyboard shortcut to toggle toolbar. Default: 'ctrl+shift+a' */
  shortcut?: string
  /** Pinia integration — surfaces store IDs in annotations */
  pinia?: VuePointOptions['pinia']
  /** MCP server options */
  mcp?: VuePointOptions['mcp']
  /** REST API options */
  api?: VuePointOptions['api']
  /** Screenshot capture */
  screenshot?: VuePointOptions['screenshot']
  /** Outbound webhooks */
  webhooks?: VuePointOptions['webhooks']
  /** App metadata included in webhook payloads */
  appMeta?: VuePointOptions['appMeta']
}

const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@jumpcloud/nuxt-vuepoint',
    configKey: 'vuepoint',
    compatibility: {
      nuxt: '>=3.0.0',
    },
  },
  defaults: {
    enabled: undefined,
  },
  setup(options, nuxt) {
    // Production guard — disable in production builds unless explicitly enabled
    const isProduction = nuxt.options.dev === false
    if (isProduction && options.enabled !== true) {
      return
    }

    const resolver = createResolver(import.meta.url)

    // Pass options to runtime via public runtimeConfig
    nuxt.options.runtimeConfig.public.vuepoint = options as Record<string, unknown>

    // Register the runtime plugin
    addPlugin({
      src: resolver.resolve('./runtime/plugin'),
      mode: 'client',
    })
  },
})

export default module
