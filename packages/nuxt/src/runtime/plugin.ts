import { defineNuxtPlugin, useRuntimeConfig, useRoute, useRouter } from '#imports'
import { VuePoint } from '@vuepoint/vue'
import type { VuePointOptions } from '@vuepoint/core'

export default defineNuxtPlugin({
  name: 'vuepoint',
  enforce: 'post',
  setup(nuxtApp) {
    const config = useRuntimeConfig()
    const moduleOptions = (config.public.vuepoint ?? {}) as Record<string, unknown>

    // Build VuePointOptions from module config
    const options: VuePointOptions = {
      enabled: moduleOptions.enabled as boolean | undefined,
      filterComponents: moduleOptions.filterComponents as string[] | false | undefined,
      shortcut: moduleOptions.shortcut as string | undefined,
      pinia: moduleOptions.pinia as VuePointOptions['pinia'],
      mcp: moduleOptions.mcp as VuePointOptions['mcp'],
      api: moduleOptions.api as VuePointOptions['api'],
      screenshot: moduleOptions.screenshot as VuePointOptions['screenshot'],
      webhooks: moduleOptions.webhooks as VuePointOptions['webhooks'],
      appMeta: moduleOptions.appMeta as VuePointOptions['appMeta'],
    }

    // Install VuePoint plugin on the Vue app
    nuxtApp.vueApp.use(VuePoint, options)
  },
})
