/**
 * Storybook preview annotation for VuePoint.
 *
 * Uses Storybook 8's setup() hook to register the VuePoint plugin
 * on the preview Vue app instance. Runs once at initialization —
 * every story automatically gets VuePoint annotations.
 */

import { setup } from '@storybook/vue3'
import { VuePoint } from '@vuepoint/vue'
import '@vuepoint/vue/style.css'

setup((app) => {
  app.use(VuePoint, { enabled: true })
})
