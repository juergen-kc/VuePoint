/**
 * build.mjs — Multi-entry build script for the Chrome extension.
 *
 * Runs vite build four times (one per entry point) and copies static
 * assets (manifest.json, icons, popup.html, popup.css) to dist/.
 */

import { execFileSync } from 'child_process'
import { cpSync, rmSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dist = resolve(root, 'dist')

// Clean dist
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
mkdirSync(resolve(dist, 'popup'), { recursive: true })
mkdirSync(resolve(dist, 'icons'), { recursive: true })

// Build each entry using execFileSync (safe, no shell injection)
const entries = ['background', 'content', 'inject', 'popup']
for (const entry of entries) {
  console.log(`\n--- Building ${entry} ---`)
  execFileSync('npx', ['vite', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITE_ENTRY: entry },
  })
}

// Copy static assets
cpSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'))
cpSync(resolve(root, 'icons'), resolve(dist, 'icons'), { recursive: true })
cpSync(resolve(root, 'src/popup/popup.html'), resolve(dist, 'popup/popup.html'))
cpSync(resolve(root, 'src/popup/popup.css'), resolve(dist, 'popup/popup.css'))

console.log('\n--- Extension build complete! Load dist/ as unpacked extension in Chrome. ---')
