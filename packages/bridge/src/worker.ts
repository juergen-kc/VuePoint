/**
 * worker.ts — VuePoint SharedWorker
 *
 * Runs as a SharedWorker in the browser, shared across all tabs of the same origin.
 * Holds canonical annotation state and broadcasts changes to all connected tabs.
 *
 * The worker also syncs state to the HTTP API server (api.ts on localhost:3742)
 * so that the MCP server and external tools can read/write annotations.
 *
 * Architecture:
 *   Browser Tab ──postMessage──▶ SharedWorker ──fetch()──▶ API Server (Fastify)
 *   Browser Tab ◀──postMessage── SharedWorker ◀──WebSocket── API Server
 */

import type { Annotation, WebhookDeliveryLog } from '@vuepoint/core'
import type { BridgeCommand, BridgeEvent, AppContext } from './types.js'

// SharedWorker global scope — declare minimal typing since WebWorker lib
// conflicts with DOM lib in the monorepo-wide tsconfig
declare const self: {
  addEventListener(type: 'connect', listener: (e: MessageEvent) => void): void
}

// ─── State ──────────────────────────────────────────────────────────────────

const ports: Map<string, MessagePort> = new Map()
const annotations: Map<string, Annotation> = new Map()
let appContext: AppContext = {}
let tabCounter = 0

// API server URL
const apiBaseUrl = 'http://localhost:3742'
let wsConnection: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null

// ─── SharedWorker entry ─────────────────────────────────────────────────────

self.addEventListener('connect', (e: MessageEvent) => {
  const port = e.ports[0]
  const tabId = `tab_${++tabCounter}`

  ports.set(tabId, port)

  port.addEventListener('message', (ev: MessageEvent<BridgeCommand>) => {
    handleCommand(tabId, ev.data)
  })

  port.start()

  // Send current state to the newly connected tab
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

  // Connect to API WebSocket on first tab connect
  if (ports.size === 1) {
    connectWebSocket()
  }
})

// ─── Command handler ────────────────────────────────────────────────────────

function handleCommand(fromTabId: string, cmd: BridgeCommand): void {
  switch (cmd.type) {
    case 'connect':
      // Tab re-identified itself — update mapping
      if (cmd.tabId !== fromTabId) {
        const port = ports.get(fromTabId)
        if (port) {
          ports.delete(fromTabId)
          ports.set(cmd.tabId, port)
        }
      }
      break

    case 'sync': {
      // Tab sends a fully-formed annotation (already has ID)
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
        syncToApi('PATCH', `/api/v1/annotations/${cmd.id}`, cmd.patch)
      }
      break
    }

    case 'remove': {
      annotations.delete(cmd.id)
      broadcast({ type: 'annotation_removed', id: cmd.id }, fromTabId)
      syncToApi('DELETE', `/api/v1/annotations/${cmd.id}`)
      break
    }

    case 'clear': {
      annotations.clear()
      broadcast({ type: 'annotations_cleared' }, fromTabId)
      // Clear all on API — delete each (no bulk endpoint)
      // For efficiency, just clear via individual DELETEs
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
        syncToApi('PATCH', `/api/v1/annotations/${cmd.id}`, {
          agentQuestionReply: cmd.reply,
          agentQuestionReplyAt: updated.agentQuestionReplyAt,
        })
      }
      break
    }
  }
}

// ─── Broadcasting ───────────────────────────────────────────────────────────

function broadcast(event: BridgeEvent, excludeTabId?: string): void {
  for (const [tabId, port] of ports) {
    if (tabId !== excludeTabId) {
      send(port, event)
    }
  }
}

function send(port: MessagePort, event: BridgeEvent): void {
  try {
    port.postMessage(event)
  } catch {
    // Port may have been closed — clean up on next operation
  }
}

// ─── API sync ───────────────────────────────────────────────────────────────

async function syncToApi(method: string, path: string, body?: unknown): Promise<void> {
  try {
    const opts: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body && method !== 'DELETE') {
      opts.body = JSON.stringify(body)
    }
    await fetch(`${apiBaseUrl}${path}`, opts)
  } catch {
    // API server may not be running — annotations still work in-browser
  }
}

// ─── WebSocket connection to API server ─────────────────────────────────────

function connectWebSocket(): void {
  try {
    const wsUrl = apiBaseUrl.replace(/^http/, 'ws') + '/ws'
    wsConnection = new WebSocket(wsUrl)

    wsConnection.addEventListener('message', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data as string) as {
          type: string
          annotation?: Annotation
          id?: string
          question?: string
          delivery?: WebhookDeliveryLog
        }

        // API server pushed an update (e.g., MCP agent acknowledged/resolved)
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
              // Update the annotation with the question
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
              // Also broadcast the dedicated question event for UI notification
              broadcast({ type: 'question_received', id: data.id, question: data.question })
            }
            break
        }
      } catch {
        // Ignore malformed messages
      }
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

function scheduleReconnect(): void {
  if (wsReconnectTimer) return
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null
    if (ports.size > 0) {
      connectWebSocket()
    }
  }, 5000)
}
