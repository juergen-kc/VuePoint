import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

/**
 * Extension build configuration.
 *
 * Builds one entry at a time, controlled by the VITE_ENTRY env var.
 * The build script runs vite build four times (background, content,
 * inject, popup) to produce separate IIFE bundles for Chrome.
 */
const entry = process.env.VITE_ENTRY ?? 'inject'

const entries: Record<string, { input: string; name: string }> = {
  background: { input: resolve(__dirname, 'src/background.ts'), name: 'background' },
  content: { input: resolve(__dirname, 'src/content.ts'), name: 'content' },
  inject: { input: resolve(__dirname, 'src/inject.ts'), name: 'inject' },
  popup: { input: resolve(__dirname, 'src/popup/popup.ts'), name: 'popup' },
}

const current = entries[entry]!

export default defineConfig({
  plugins: entry === 'inject' ? [vue()] : [],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome120',
    lib: {
      entry: current.input,
      formats: ['iife'],
      name: `VuePoint_${current.name}`,
      fileName: () => {
        if (entry === 'popup') return 'popup/popup.js'
        return `${current.name}.js`
      },
    },
    rollupOptions: {
      external: [],
      output: {
        assetFileNames: (info) => {
          if (info.name?.endsWith('.css')) return 'vuepoint.css'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
    minify: false,
  },
  resolve: {
    alias: {
      '@vuepoint/core': resolve(__dirname, '../core/src/index.ts'),
      '@vuepoint/vue': resolve(__dirname, '../vue/src/index.ts'),
      '@vuepoint/bridge': resolve(__dirname, '../bridge/src/index.ts'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
})
