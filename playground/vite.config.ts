import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    dedupe: ['vue'],
    alias: {
      '@vuepoint/vue': path.resolve(__dirname, '../packages/vue/src/index.ts'),
      '@vuepoint/core': path.resolve(__dirname, '../packages/core/src/index.ts'),
      '@vuepoint/bridge': path.resolve(__dirname, '../packages/bridge/src/index.ts'),
    },
  },
})
