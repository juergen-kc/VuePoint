/**
 * popup.ts — Extension popup script
 *
 * Manages the configuration UI for VuePoint settings (ports, auth token)
 * and triggers injection into the active tab.
 */

const mcpPortInput = document.getElementById('mcp-port') as HTMLInputElement
const apiPortInput = document.getElementById('api-port') as HTMLInputElement
const authTokenInput = document.getElementById('auth-token') as HTMLInputElement
const autoInjectCheckbox = document.getElementById('auto-inject') as HTMLInputElement
const injectBtn = document.getElementById('inject-btn') as HTMLButtonElement
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement
const statusEl = document.getElementById('status') as HTMLDivElement
const messageEl = document.getElementById('message') as HTMLDivElement

// ── Load saved settings ───────────────────────────────────────────────────────

chrome.runtime.sendMessage({ type: 'get-settings' }, (settings) => {
  if (settings) {
    mcpPortInput.value = String(settings.mcpPort ?? 3742)
    apiPortInput.value = String(settings.apiPort ?? 3742)
    authTokenInput.value = settings.authToken ?? ''
    autoInjectCheckbox.checked = settings.autoInject ?? false
  }
})

// ── Check current tab status ──────────────────────────────────────────────────

async function updateStatus(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  // Check if already injected
  const status = await chrome.runtime.sendMessage({ type: 'get-status', tabId: tab.id })

  if (status?.injected) {
    setStatus('injected', 'VuePoint is active on this page')
    injectBtn.disabled = true
    injectBtn.textContent = 'Already Injected'
    return
  }

  // Check if Vue is detected
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selectors = ['#app', '#__nuxt', '[data-v-app]', '#root']
        for (const sel of selectors) {
          const el = document.querySelector(sel)
          if (el && '__vue_app__' in el) return true
        }
        for (const child of document.body.children) {
          if ('__vue_app__' in child) return true
        }
        return false
      },
    })

    if (result?.result) {
      setStatus('detected', 'Vue 3 app detected')
      injectBtn.disabled = false
    } else {
      setStatus('none', 'No Vue 3 app found on this page')
      injectBtn.disabled = true
    }
  } catch {
    setStatus('none', 'Cannot access this page')
    injectBtn.disabled = true
  }
}

function setStatus(type: 'scanning' | 'detected' | 'injected' | 'none', text: string): void {
  statusEl.className = `status status--${type}`
  const textEl = statusEl.querySelector('.status-text')
  if (textEl) textEl.textContent = text
}

function showMessage(text: string, type: 'success' | 'error'): void {
  messageEl.textContent = text
  messageEl.className = `message message--${type}`
  setTimeout(() => {
    messageEl.className = 'message hidden'
  }, 3000)
}

// ── Inject button ─────────────────────────────────────────────────────────────

injectBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  injectBtn.disabled = true
  injectBtn.textContent = 'Injecting...'

  chrome.runtime.sendMessage({ type: 'inject-vuepoint', tabId: tab.id })

  // Wait a moment, then update status
  setTimeout(() => {
    setStatus('injected', 'VuePoint is active on this page')
    injectBtn.textContent = 'Already Injected'
    showMessage('VuePoint injected successfully!', 'success')
  }, 500)
})

// ── Save settings ─────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', () => {
  const settings = {
    mcpPort: parseInt(mcpPortInput.value, 10) || 3742,
    apiPort: parseInt(apiPortInput.value, 10) || 3742,
    authToken: authTokenInput.value.trim(),
    autoInject: autoInjectCheckbox.checked,
  }

  chrome.runtime.sendMessage({ type: 'save-settings', settings }, () => {
    showMessage('Settings saved', 'success')
  })
})

// ── Listen for injection events ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'injection-complete') {
    setStatus('injected', 'VuePoint is active on this page')
    injectBtn.disabled = true
    injectBtn.textContent = 'Already Injected'
  }
})

// ── Init ──────────────────────────────────────────────────────────────────────

updateStatus()
