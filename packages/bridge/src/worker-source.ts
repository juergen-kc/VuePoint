/**
 * Worker source as a string for Blob URL creation.
 *
 * SharedWorkers cannot be loaded from data: URLs in Chrome (security restriction).
 * Instead, we inline the worker source as a string and create a blob: URL at runtime.
 *
 * This file is the single source of truth for the worker logic.
 * Keep it in sync with the types in ./types.ts.
 */

export const WORKER_SOURCE = /* js */ `
const ports = new Map()
const annotations = new Map()
let appContext = {}
let tabCounter = 0

const apiBaseUrl = 'http://localhost:3742'
let wsConnection = null
let wsReconnectTimer = null

self.addEventListener('connect', (e) => {
  const port = e.ports[0]
  const tabId = 'tab_' + (++tabCounter)

  ports.set(tabId, port)

  port.addEventListener('message', (ev) => {
    handleCommand(tabId, ev.data)
  })

  port.start()

  send(port, {
    type: 'connected',
    tabId,
    tabCount: ports.size,
  })

  send(port, {
    type: 'state',
    annotations: Array.from(annotations.values()),
    context: appContext,
  })

  if (ports.size === 1) {
    connectWebSocket()
  }
})

function handleCommand(fromTabId, cmd) {
  switch (cmd.type) {
    case 'connect':
      if (cmd.tabId !== fromTabId) {
        const port = ports.get(fromTabId)
        if (port) {
          ports.delete(fromTabId)
          ports.set(cmd.tabId, port)
        }
      }
      break

    case 'sync': {
      annotations.set(cmd.annotation.id, cmd.annotation)
      broadcast({ type: 'annotation_created', annotation: cmd.annotation }, fromTabId)
      syncToApi('POST', '/api/v1/annotations', cmd.annotation)
      break
    }

    case 'update': {
      const existing = annotations.get(cmd.id)
      if (existing) {
        const updated = { ...existing, ...cmd.patch, updatedAt: new Date().toISOString() }
        annotations.set(cmd.id, updated)
        broadcast({ type: 'annotation_updated', annotation: updated }, fromTabId)
        syncToApi('PATCH', '/api/v1/annotations/' + cmd.id, cmd.patch)
      }
      break
    }

    case 'remove': {
      annotations.delete(cmd.id)
      broadcast({ type: 'annotation_removed', id: cmd.id }, fromTabId)
      syncToApi('DELETE', '/api/v1/annotations/' + cmd.id)
      break
    }

    case 'clear': {
      annotations.clear()
      broadcast({ type: 'annotations_cleared' }, fromTabId)
      break
    }

    case 'context': {
      appContext = cmd.context
      broadcast({ type: 'context_updated', context: appContext }, fromTabId)
      syncToApi('POST', '/api/v1/context', appContext)
      break
    }

    case 'get_state': {
      const port = ports.get(fromTabId)
      if (port) {
        send(port, {
          type: 'state',
          annotations: Array.from(annotations.values()),
          context: appContext,
        })
      }
      break
    }

    case 'reply_question': {
      const existing = annotations.get(cmd.id)
      if (existing) {
        const updated = {
          ...existing,
          agentQuestionReply: cmd.reply,
          agentQuestionReplyAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        annotations.set(cmd.id, updated)
        broadcast({ type: 'annotation_updated', annotation: updated }, fromTabId)
        syncToApi('PATCH', '/api/v1/annotations/' + cmd.id, {
          agentQuestionReply: cmd.reply,
          agentQuestionReplyAt: updated.agentQuestionReplyAt,
        })
      }
      break
    }
  }
}

function broadcast(event, excludeTabId) {
  for (const [tabId, port] of ports) {
    if (tabId !== excludeTabId) {
      send(port, event)
    }
  }
}

function send(port, event) {
  try {
    port.postMessage(event)
  } catch {}
}

async function syncToApi(method, path, body) {
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body && method !== 'DELETE') {
      opts.body = JSON.stringify(body)
    }
    await fetch(apiBaseUrl + path, opts)
  } catch {}
}

function connectWebSocket() {
  try {
    const wsUrl = apiBaseUrl.replace(/^http/, 'ws') + '/ws'
    wsConnection = new WebSocket(wsUrl)

    wsConnection.addEventListener('message', (ev) => {
      try {
        const data = JSON.parse(ev.data)

        switch (data.type) {
          case 'annotation_updated':
            if (data.annotation) {
              annotations.set(data.annotation.id, data.annotation)
              broadcast({ type: 'annotation_updated', annotation: data.annotation })
            }
            break
          case 'annotation_removed':
            if (data.id) {
              annotations.delete(data.id)
              broadcast({ type: 'annotation_removed', id: data.id })
            }
            break
          case 'webhook_delivery':
            if (data.delivery) {
              broadcast({ type: 'webhook_delivery', delivery: data.delivery })
            }
            break
          case 'question_received':
            if (data.id && data.question) {
              const ann = annotations.get(data.id)
              if (ann) {
                const updated = {
                  ...ann,
                  agentQuestion: data.question,
                  agentQuestionAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
                annotations.set(data.id, updated)
                broadcast({ type: 'annotation_updated', annotation: updated })
              }
              broadcast({ type: 'question_received', id: data.id, question: data.question })
            }
            break
        }
      } catch {}
    })

    wsConnection.addEventListener('close', () => {
      wsConnection = null
      scheduleReconnect()
    })

    wsConnection.addEventListener('error', () => {
      wsConnection?.close()
    })
  } catch {
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (wsReconnectTimer) return
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null
    if (ports.size > 0) {
      connectWebSocket()
    }
  }, 5000)
}
`
