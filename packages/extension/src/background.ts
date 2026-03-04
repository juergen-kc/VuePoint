/**
 * background.ts — Chrome Extension Service Worker
 *
 * Manages extension state (per-tab VuePoint injection status) and serves
 * as the communication hub between popup and content scripts.
 */

interface VuePointSettings {
  mcpPort: number
  apiPort: number
  authToken: string
  autoInject: boolean
}

const DEFAULT_SETTINGS: VuePointSettings = {
  mcpPort: 3741,
  apiPort: 3742,
  authToken: '',
  autoInject: false,
}

/** Tracks which tabs have VuePoint injected */
const injectedTabs = new Set<number>()

// ── Message handling ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'vue-detected': {
      const tabId = sender.tab?.id
      if (tabId != null) {
        // Update badge to show Vue was detected
        chrome.action.setBadgeText({ text: 'Vue', tabId })
        chrome.action.setBadgeBackgroundColor({ color: '#42b883', tabId })

        // Auto-inject if enabled
        chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
          if ((settings as VuePointSettings).autoInject && !injectedTabs.has(tabId)) {
            injectVuePoint(tabId)
          }
        })
      }
      sendResponse({ ok: true })
      break
    }

    case 'inject-vuepoint': {
      const tabId = message.tabId as number | undefined
      if (tabId != null) {
        injectVuePoint(tabId)
      }
      sendResponse({ ok: true })
      break
    }

    case 'get-status': {
      const tabId = message.tabId as number | undefined
      sendResponse({
        injected: tabId != null && injectedTabs.has(tabId),
      })
      break
    }

    case 'get-settings': {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
        sendResponse(settings)
      })
      return true // async response
    }

    case 'save-settings': {
      chrome.storage.sync.set(message.settings as VuePointSettings, () => {
        sendResponse({ ok: true })
      })
      return true
    }

    default:
      sendResponse({ error: 'unknown message type' })
  }
})

// Clean up when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId)
})

// Clean up badge on navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    injectedTabs.delete(tabId)
    chrome.action.setBadgeText({ text: '', tabId })
  }
})

// ── Injection ─────────────────────────────────────────────────────────────────

function injectVuePoint(tabId: number): void {
  if (injectedTabs.has(tabId)) return

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    const { mcpPort, apiPort, authToken } = settings as VuePointSettings

    // First inject CSS
    chrome.scripting.insertCSS({
      target: { tabId },
      files: ['vuepoint.css'],
    }).catch(() => {
      // CSS may not exist if toolbar styles are inlined
    })

    // Then inject the main script with settings
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['inject.js'],
    }).then(() => {
      // Pass settings to the injected script via a custom event
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (port: number, aPort: number, token: string) => {
          window.dispatchEvent(new CustomEvent('vuepoint-ext:configure', {
            detail: { mcpPort: port, apiPort: aPort, authToken: token },
          }))
        },
        args: [mcpPort, apiPort, authToken],
      })

      injectedTabs.add(tabId)

      // Update badge
      chrome.action.setBadgeText({ text: 'ON', tabId })
      chrome.action.setBadgeBackgroundColor({ color: '#42b883', tabId })

      // Notify popup
      chrome.runtime.sendMessage({ type: 'injection-complete', tabId }).catch(() => {
        // Popup may not be open
      })
    }).catch((err) => {
      console.error('[VuePoint Extension] Failed to inject:', err)
    })
  })
}
