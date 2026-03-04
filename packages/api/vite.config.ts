import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/api.ts',
      formats: ['es'],
      fileName: () => 'api.js',
    },
    rollupOptions: {
      external: [
        '@vuepoint/core',
        'fastify',
        '@fastify/cors',
        'node:crypto',
      ],
    },
    target: 'node18',
  },
})
