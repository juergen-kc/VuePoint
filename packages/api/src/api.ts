/**
 * api.ts — VuePoint REST API + Webhook Bridge
 *
 * Serves two roles:
 *   1. REST API for external tooling / dashboards
 *   2. HTTP bridge between the browser SharedWorker and the stdio MCP server
 *
 * The browser plugin POSTs annotation updates here, and the MCP server
 * reads/writes via the same HTTP surface.
 *
 * Run: node packages/api/dist/api.js
 * Port: VUEPOINT_API_PORT (default 3742) for external REST
 *       VUEPOINT_BRIDGE_PORT (default 3741) for MCP bridge (same server, path-routed)
 */

import Fastify from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import cors from '@fastify/cors'
import crypto from 'node:crypto'
import type { WebSocket } from 'ws'
import type {
  Annotation,
  WebhookConfig,
  WebhookEvent,
  WebhookPayload,
} from '@vuepoint/core'
import { generateId, now } from '@vuepoint/core'

const PORT = Number(process.env.VUEPOINT_API_PORT ?? 3742)
const AUTH_TOKEN = process.env.VUEPOINT_AUTH_TOKEN
const CORS_ORIGINS = process.env.VUEPOINT_CORS?.split(',') ?? ['http://localhost:5173', 'http://localhost:3000']

// Webhook configs loaded from env JSON or set via API
let webhooks: WebhookConfig[] = []
try {
  if (process.env.VUEPOINT_WEBHOOKS) {
    webhooks = JSON.parse(process.env.VUEPOINT_WEBHOOKS)
  }
} catch { /* no-op */ }

// In-memory annotation store (shared between REST API and MCP bridge)
// In production this would be backed by SQLite or Redis for persistence
const annotationStore = new Map<string, Annotation>()

const sessionId = generateId()
const appMeta = {
  name: process.env.VUEPOINT_APP_NAME,
  version: process.env.VUEPOINT_APP_VERSION,
}

// ─── Server setup ─────────────────────────────────────────────────────────────

const app = Fastify({ logger: false })

await app.register(fastifyWebsocket)
await app.register(cors, {
  origin: CORS_ORIGINS,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
})

// ─── WebSocket clients ──────────────────────────────────────────────────────

const wsClients = new Set<WebSocket>()

function broadcastWs(data: Record<string, unknown>): void {
  const msg = JSON.stringify(data)
  for (const ws of wsClients) {
    try {
      if (ws.readyState === 1) { // OPEN
        ws.send(msg)
      }
    } catch {
      wsClients.delete(ws)
    }
  }
}

app.register(async (fastify) => {
  fastify.get('/ws', { websocket: true }, (socket) => {
    wsClients.add(socket)
    socket.on('close', () => wsClients.delete(socket))
    socket.on('error', () => wsClients.delete(socket))
  })
})

// Auth middleware
app.addHook('preHandler', async (req, reply) => {
  if (!AUTH_TOKEN) return // auth disabled
  if (req.url === '/health' || req.url === '/api/v1/health') return // health check always open

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ') || header.slice(7) !== AUTH_TOKEN) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
})

// ─── Health ───────────────────────────────────────────────────────────────────

const healthResponse = async () => ({
  status: 'ok',
  version: '0.1.0',
  annotations: annotationStore.size,
  sessionId,
})

app.get('/health', healthResponse)
app.get('/api/v1/health', healthResponse)

// ─── Annotations CRUD ─────────────────────────────────────────────────────────

app.get('/api/v1/annotations', async (req) => {
  const { status = 'pending' } = req.query as { status?: string }
  const all = Array.from(annotationStore.values())
  return status === 'all' ? all : all.filter((a) => a.status === status)
})

app.get('/api/v1/annotations/export', async (req, reply) => {
  const { format = 'json', status } = req.query as { format?: 'json' | 'markdown' | 'csv'; status?: string }
  let all = Array.from(annotationStore.values())
  if (status && status !== 'all') {
    all = all.filter((a) => a.status === status)
  }

  if (format === 'markdown') {
    const { formatAnnotation } = await import('@vuepoint/core')
    const lines = ['## VuePoint Annotations', '', `> ${all.length} annotation${all.length !== 1 ? 's' : ''}`, '']
    for (const ann of all) {
      lines.push(formatAnnotation(ann))
      lines.push('')
      lines.push('---')
      lines.push('')
    }
    reply.type('text/markdown')
    return lines.join('\n').trimEnd()
  }

  if (format === 'csv') {
    const headers = ['id', 'status', 'selector', 'elementDescription', 'feedback', 'expected', 'actual', 'route', 'createdAt', 'updatedAt']
    const csvEscape = (v: string | undefined) => {
      if (!v) return ''
      if (v.includes(',') || v.includes('"') || v.includes('\n')) return `"${v.replace(/"/g, '""')}"`
      return v
    }
    const rows = all.map((a) => headers.map((h) => csvEscape(String(a[h as keyof typeof a] ?? ''))).join(','))
    reply.type('text/csv')
    reply.header('Content-Disposition', 'attachment; filename="annotations.csv"')
    return [headers.join(','), ...rows].join('\n')
  }

  return all
})

app.get('/api/v1/annotations/:id', async (req, reply) => {
  const { id } = req.params as { id: string }
  const ann = annotationStore.get(id)
  if (!ann) return reply.status(404).send({ error: 'Not found' })
  return ann
})

app.post('/api/v1/annotations', async (req, reply) => {
  const body = req.body as Partial<Annotation>
  if (!body.selector || !body.feedback) {
    return reply.status(400).send({ error: 'selector and feedback are required' })
  }

  const ann: Annotation = {
    id: generateId(),
    status: 'pending',
    createdAt: now(),
    updatedAt: now(),
    selector: body.selector,
    elementDescription: body.elementDescription ?? body.selector,
    componentChain: body.componentChain ?? [],
    feedback: body.feedback,
    expected: body.expected,
    actual: body.actual,
    piniaStores: body.piniaStores,
    route: body.route,
  }

  annotationStore.set(ann.id, ann)
  await fireWebhook('annotation.created', ann)
  return reply.status(201).send(ann)
})

app.patch('/api/v1/annotations/:id', async (req, reply) => {
  const { id } = req.params as { id: string }
  const ann = annotationStore.get(id)
  if (!ann) return reply.status(404).send({ error: 'Not found' })

  const patch = req.body as Partial<Annotation>
  const updated: Annotation = { ...ann, ...patch, updatedAt: now() }

  if (patch.status === 'acknowledged' && !updated.acknowledgedAt) {
    updated.acknowledgedAt = now()
  }
  if (patch.status === 'resolved' && !updated.resolvedAt) {
    updated.resolvedAt = now()
  }

  annotationStore.set(id, updated)

  // Push update to connected WebSocket clients (browser tabs via bridge)
  broadcastWs({ type: 'annotation_updated', annotation: updated })

  const eventMap: Partial<Record<string, WebhookEvent>> = {
    acknowledged: 'annotation.acknowledged',
    resolved: 'annotation.resolved',
    dismissed: 'annotation.dismissed',
  }
  const event = patch.status ? eventMap[patch.status] : 'annotation.updated'
  if (event) await fireWebhook(event, updated)

  return updated
})

app.delete('/api/v1/annotations/:id', async (req, reply) => {
  const { id } = req.params as { id: string }
  if (!annotationStore.has(id)) return reply.status(404).send({ error: 'Not found' })
  annotationStore.delete(id)
  broadcastWs({ type: 'annotation_removed', id })
  reply.status(204).send()
})

app.post('/api/v1/annotations/:id/ask', async (req, reply) => {
  const { id } = req.params as { id: string }
  const ann = annotationStore.get(id)
  if (!ann) return reply.status(404).send({ error: 'Not found' })
  const { question } = req.body as { question: string }
  // In Phase 2: push question to browser via WebSocket/SSE
  // For now: store as a note in the annotation
  const updated = { ...ann, agentQuestion: question, updatedAt: now() }
  annotationStore.set(id, updated as Annotation)
  return { status: 'question_sent', question }
})

// ─── App context ──────────────────────────────────────────────────────────────

let appContext: Record<string, unknown> = {}

app.get('/api/v1/context', async () => appContext)

// Called by the browser plugin to sync current route/context
app.post('/api/v1/context', async (req) => {
  appContext = req.body as Record<string, unknown>
  return { ok: true }
})

// ─── Component info ───────────────────────────────────────────────────────────

app.get('/api/v1/component', async (req, reply) => {
  const { selector, name } = req.query as { selector?: string; name?: string }
  if (!selector && !name) {
    return reply.status(400).send({ error: 'selector or name required' })
  }
  // Proxy to browser via SSE/WS — for now return a stub
  // Phase 2: browser responds to an inspection request via WebSocket
  return {
    note: 'Component inspection requires a WebSocket connection to the browser. Available in Phase 2.',
    queried: { selector, name },
  }
})

// ─── Webhook management ───────────────────────────────────────────────────────

app.get('/api/v1/webhooks', async () => webhooks.map((w) => ({ url: w.url, events: w.events })))

app.post('/api/v1/webhooks/test', async (req) => {
  const { url } = req.body as { url?: string }
  const target = url ?? webhooks[0]?.url
  if (!target) return { error: 'No webhook configured' }

  const testPayload: WebhookPayload = {
    event: 'session.started',
    timestamp: now(),
    meta: { sessionId, ...appMeta },
  }
  const delivered = await deliverWebhook(target, undefined, testPayload)
  return { delivered, url: target }
})

// ─── Webhook engine ───────────────────────────────────────────────────────────

async function fireWebhook(event: WebhookEvent, annotation?: Annotation): Promise<void> {
  const matching = webhooks.filter(
    (w) => !w.events || w.events.includes(event)
  )
  if (matching.length === 0) return

  const payload: WebhookPayload = {
    event,
    timestamp: now(),
    annotation,
    meta: { sessionId, ...appMeta },
  }

  await Promise.allSettled(
    matching.map((w) => deliverWebhookWithRetry(w.url, w.secret, payload))
  )
}

async function deliverWebhookWithRetry(
  url: string,
  secret: string | undefined,
  payload: WebhookPayload,
  attempts = 3
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    const ok = await deliverWebhook(url, secret, payload)
    if (ok) return
    if (i < attempts - 1) {
      await sleep([1000, 5000, 30000][i])
    }
  }
  console.error(`[VuePoint] Webhook delivery failed after ${attempts} attempts: ${url}`)
}

async function deliverWebhook(
  url: string,
  secret: string | undefined,
  payload: WebhookPayload
): Promise<boolean> {
  try {
    const body = JSON.stringify(payload)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'VuePoint/0.1.0',
      'X-VuePoint-Event': payload.event,
    }

    if (secret) {
      const sig = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex')
      headers['X-VuePoint-Signature-256'] = `sha256=${sig}`
    }

    const res = await fetch(url, { method: 'POST', headers, body })
    return res.ok
  } catch (err) {
    console.error(`[VuePoint] Webhook error:`, err)
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Start ────────────────────────────────────────────────────────────────────

await app.listen({ port: PORT, host: '127.0.0.1' })
console.log(`[VuePoint API] Listening on http://127.0.0.1:${PORT}`)
