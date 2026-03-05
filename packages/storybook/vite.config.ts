import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({ rollupTypes: false }),
  ],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        preset: 'src/preset.ts',
        preview: 'src/preview.ts',
      },
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        '@storybook/vue3',
        '@vuepoint/vue',
        '@vuepoint/vue/style.css',
        'node:path',
        'node:url',
      ],
      output: {
        exports: 'named',
      },
    },
  },
})
