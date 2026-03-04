import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/server.ts',
      formats: ['es'],
      fileName: () => 'server.js',
    },
    rollupOptions: {
      external: [
        '@modelcontextprotocol/sdk/server/index.js',
        '@modelcontextprotocol/sdk/server/stdio.js',
        '@modelcontextprotocol/sdk/types.js',
        'zod',
      ],
    },
    target: 'node18',
  },
})
