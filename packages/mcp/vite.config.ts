import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: {
        server: 'src/server.ts',
        cli: 'src/cli.ts',
      },
      formats: ['es'],
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
