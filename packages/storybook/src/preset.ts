/**
 * Storybook preset for VuePoint.
 *
 * Storybook auto-discovers this file when '@vuepoint/storybook' is added
 * to the addons array in .storybook/main.ts.
 *
 * It registers a preview annotation that sets up VuePoint on the Vue app.
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

export function previewAnnotations(entry: string[] = []) {
  return [
    ...entry,
    join(dir, 'preview'),
  ]
}
