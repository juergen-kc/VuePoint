#!/usr/bin/env node

/**
 * cli.ts — VuePoint CLI entry point
 *
 * Usage:
 *   npx vuepoint mcp    — start the MCP stdio server
 */

export {}

const command = process.argv[2]

if (command === 'mcp') {
  await import('./server.js')
} else {
  console.error('Usage: vuepoint <command>')
  console.error('')
  console.error('Commands:')
  console.error('  mcp    Start the MCP stdio server for AI agent integration')
  process.exit(1)
}
