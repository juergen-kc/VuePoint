import { ref, onUnmounted, type Ref } from 'vue'
import type { Annotation, AnnotationStatus } from '@vuepoint/core'

export interface AppContext {
  route?: string
  routeName?: string
  pageComponent?: string
  piniaStores?: string[]
}

interface BridgeEvent {
  type: string
  annotation?: Annotation
  id?: string
  context?: AppContext
}

export interface ApiClient {
  annotations: Ref<Annotation[]>
  context: Ref<AppContext>
  connected: Ref<boolean>
  loading: Ref<boolean>
  error: Ref<string | null>
  fetchAnnotations(status?: AnnotationStatus | 'all'): Promise<void>
  fetchContext(): Promise<void>
  exportAnnotations(format: 'json' | 'markdown' | 'csv', status?: AnnotationStatus | 'all'): Promise<string>
  connect(): void
  disconnect(): void
}

const API_BASE = 'http://localhost:3742'
const WS_URL = 'ws://localhost:3742/ws'

export function useApiClient(): ApiClient {
  const annotations = ref<Annotation[]>([])
  const context = ref<AppContext>({})
  const connected = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  async function fetchAnnotations(status: AnnotationStatus | 'all' = 'all') {
    loading.value = true
    error.value = null
    try {
      const params = status !== 'all' ? `?status=${status}` : ''
      const res = await fetch(`${API_BASE}/api/v1/annotations${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      annotations.value = await res.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch annotations'
    } finally {
      loading.value = false
    }
  }

  async function fetchContext() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/context`)
      if (!res.ok) return
      context.value = await res.json()
    } catch {
      // Context fetch is best-effort
    }
  }

  async function exportAnnotations(
    format: 'json' | 'markdown' | 'csv',
    status: AnnotationStatus | 'all' = 'all'
  ): Promise<string> {
    const params = new URLSearchParams({ format })
    if (status !== 'all') params.set('status', status)
    const res = await fetch(`${API_BASE}/api/v1/annotations/export?${params}`)
    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`)
    return res.text()
  }

  function handleWsMessage(data: BridgeEvent) {
    switch (data.type) {
      case 'annotation_created': {
        if (data.annotation) {
          const idx = annotations.value.findIndex(a => a.id === data.annotation!.id)
          if (idx === -1) annotations.value = [...annotations.value, data.annotation]
        }
        break
      }
      case 'annotation_updated': {
        if (data.annotation) {
          annotations.value = annotations.value.map(a =>
            a.id === data.annotation!.id ? data.annotation! : a
          )
        }
        break
      }
      case 'annotation_removed': {
        if (data.id) {
          annotations.value = annotations.value.filter(a => a.id !== data.id)
        }
        break
      }
      case 'annotations_cleared': {
        annotations.value = []
        break
      }
      case 'context_updated': {
        if (data.context) context.value = data.context
        break
      }
    }
  }

  function connectWs() {
    if (ws) return
    try {
      ws = new WebSocket(WS_URL)
      ws.onopen = () => { connected.value = true }
      ws.onclose = () => {
        connected.value = false
        ws = null
        reconnectTimer = setTimeout(connectWs, 5000)
      }
      ws.onerror = () => { ws?.close() }
      ws.onmessage = (e) => {
        try {
          handleWsMessage(JSON.parse(e.data))
        } catch {
          // Ignore malformed messages
        }
      }
    } catch {
      reconnectTimer = setTimeout(connectWs, 5000)
    }
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
    ws = null
    connected.value = false
  }

  function connect() {
    connectWs()
    fetchAnnotations()
    fetchContext()
  }

  onUnmounted(disconnect)

  return {
    annotations,
    context,
    connected,
    loading,
    error,
    fetchAnnotations,
    fetchContext,
    exportAnnotations,
    connect,
    disconnect,
  }
}
