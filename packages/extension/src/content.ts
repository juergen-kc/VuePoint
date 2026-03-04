/**
 * content.ts — Content Script (ISOLATED world)
 *
 * Detects Vue 3 applications on the current page by checking for
 * __vue_app__ on common root elements. Notifies the background
 * service worker when a Vue 3 app is found.
 */

const VUE_ROOT_SELECTORS = ['#app', '#__nuxt', '[data-v-app]', '#root']
const MAX_ATTEMPTS = 20
const POLL_INTERVAL_MS = 500

let detected = false

function checkForVueApp(): boolean {
  for (const selector of VUE_ROOT_SELECTORS) {
    const el = document.querySelector(selector) as HTMLElement | null
    if (el && '__vue_app__' in el) {
      return true
    }
  }

  // Fallback: scan all direct children of body
  for (const child of document.body.children) {
    if ('__vue_app__' in child) {
      return true
    }
  }

  return false
}

function startDetection(): void {
  let attempts = 0

  function poll(): void {
    if (detected) return

    if (checkForVueApp()) {
      detected = true
      chrome.runtime.sendMessage({ type: 'vue-detected' }).catch(() => {
        // Extension context may be invalidated
      })
      return
    }

    attempts++
    if (attempts < MAX_ATTEMPTS) {
      setTimeout(poll, POLL_INTERVAL_MS)
    }
  }

  // Start polling after a short delay to let the app hydrate
  setTimeout(poll, 300)
}

// Listen for injection requests from popup (via background)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'check-vue') {
    sendResponse({ detected: checkForVueApp() })
  }
})

startDetection()
