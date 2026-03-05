/**
 * client.ts — VuePoint Bridge Client
 *
 * Browser-side client that connects to the SharedWorker and provides
 * a typed API for the Vue plugin to sync annotations across tabs
 * and to the API server.
 *
 * Usage:
 *   const bridge = createBridgeClient()
 *   bridge.connect()
 *   bridge.syncAnnotation(annotation)
 *   bridge.onStateUpdate((annotations) => { ... })
 */

import type { Annotation } from '@vuepoint/core'
import type { BridgeCommand, BridgeEvent, AppContext } from './types.js'
import { WORKER_SOURCE } from './worker-source.js'

export interface BridgeClientOptions {
  /** URL to the SharedWorker script. Default: auto-resolved */
  workerUrl?: string | URL
}

export interface BridgeClient {
  /** Connect to the SharedWorker */
  connect(): void
  /** Disconnect from the SharedWorker */
  disconnect(): void
  /** Whether the client is connected */
  readonly connected: boolean
  /** Sync a fully-formed annotation to the bridge */
  syncAnnotation(annotation: Annotation): void
  /** Update an existing annotation */
  updateAnnotation(id: string, patch: Partial<Annotation>): void
  /** Remove an annotation */
  removeAnnotation(id: string): void
  /** Clear all annotations */
  clearAnnotations(): void
  /** Update app context (route, stores, etc.) */
  updateContext(context: AppContext): void
  /** Request full state from the worker */
  requestState(): void
  /** Reply to an agent question */
  replyQuestion(id: string, reply: string): void
  /** Register a callback for state events */
  onEvent(handler: (event: BridgeEvent) => void): () => void
}

export function createBridgeClient(options: BridgeClientOptions = {}): BridgeClient {
  let worker: SharedWorker | null = null
  let port: MessagePort | null = null
  let isConnected = false
  const handlers = new Set<(event: BridgeEvent) => void>()

  function connect(): void {
    if (isConnected) return

    // Check SharedWorker support
    if (typeof SharedWorker === 'undefined') {
      console.warn('[VuePoint Bridge] SharedWorker not supported in this browser. Bridge disabled.')
      return
    }

    try {
      const workerUrl = options.workerUrl ?? URL.createObjectURL(
        new Blob([WORKER_SOURCE], { type: 'application/javascript' })
      )
      worker = new SharedWorker(workerUrl, { name: 'vuepoint-bridge' })
      port = worker.port

      port.addEventListener('message', (ev: MessageEvent<BridgeEvent>) => {
        for (const handler of handlers) {
          try {
            handler(ev.data)
          } catch (err) {
            console.error('[VuePoint Bridge] Event handler error:', err)
          }
        }
      })

      port.start()
      isConnected = true
    } catch (err) {
      console.warn('[VuePoint Bridge] Failed to create SharedWorker:', err)
    }
  }

  function disconnect(): void {
    if (port) {
      port.close()
      port = null
    }
    worker = null
    isConnected = false
  }

  function sendCommand(cmd: BridgeCommand): void {
    if (!port) return
    try {
      port.postMessage(cmd)
    } catch {
      // Port closed — mark disconnected
      isConnected = false
    }
  }

  function syncAnnotation(annotation: Annotation): void {
    sendCommand({ type: 'sync', annotation })
  }

  function updateAnnotation(id: string, patch: Partial<Annotation>): void {
    sendCommand({ type: 'update', id, patch })
  }

  function removeAnnotation(id: string): void {
    sendCommand({ type: 'remove', id })
  }

  function clearAnnotations(): void {
    sendCommand({ type: 'clear' })
  }

  function updateContext(context: AppContext): void {
    sendCommand({ type: 'context', context })
  }

  function requestState(): void {
    sendCommand({ type: 'get_state' })
  }

  function replyQuestion(id: string, reply: string): void {
    sendCommand({ type: 'reply_question', id, reply })
  }

  function onEvent(handler: (event: BridgeEvent) => void): () => void {
    handlers.add(handler)
    return () => handlers.delete(handler)
  }

  return {
    connect,
    disconnect,
    get connected() {
      return isConnected
    },
    syncAnnotation,
    updateAnnotation,
    removeAnnotation,
    clearAnnotations,
    updateContext,
    requestState,
    replyQuestion,
    onEvent,
  }
}
