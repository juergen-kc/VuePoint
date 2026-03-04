# REST API Reference

The VuePoint REST API runs on `http://127.0.0.1:3742` by default and provides full CRUD access to annotations.

## Authentication

When configured with an auth token, include it as a Bearer token:

```bash
curl -H 'Authorization: Bearer YOUR_TOKEN' http://localhost:3742/api/v1/annotations
```

## Endpoints

### Health Check

```
GET /health
GET /api/v1/health
```

Returns `{ "status": "ok" }`.

---

### List Annotations

```
GET /api/v1/annotations?status=pending
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | `'pending' \| 'acknowledged' \| 'resolved' \| 'dismissed' \| 'all'` | `'all'` | Filter by status |

**Response:** `Annotation[]`

---

### Get Annotation

```
GET /api/v1/annotations/:id
```

**Response:** `Annotation`

---

### Create Annotation

```
POST /api/v1/annotations
Content-Type: application/json
```

```json
{
  "selector": ".user-form > button",
  "elementDescription": "button \"Save\"",
  "feedback": "Button not disabled during save",
  "expected": "Should disable and show spinner",
  "actual": "Allows double-click"
}
```

**Response:** `Annotation` (with generated `id`, `status: 'pending'`, timestamps)

---

### Update Annotation

```
PATCH /api/v1/annotations/:id
Content-Type: application/json
```

```json
{
  "status": "acknowledged",
  "feedback": "Updated feedback text"
}
```

**Response:** `Annotation`

---

### Delete Annotation

```
DELETE /api/v1/annotations/:id
```

**Response:** `{ "deleted": true }`

---

### Export Annotations

```
GET /api/v1/annotations/export?format=markdown&status=pending
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | `'json' \| 'markdown' \| 'csv'` | `'json'` | Export format |
| `status` | `string` | `'all'` | Filter by status |

**Response:** Formatted annotation data in the requested format.

---

### Ask Question

```
POST /api/v1/annotations/:id/ask
Content-Type: application/json
```

```json
{
  "question": "Should the spinner replace the button text or appear beside it?"
}
```

Sends a clarifying question to the user's toolbar.

---

### Reply to Question

```
POST /api/v1/annotations/:id/reply
Content-Type: application/json
```

```json
{
  "reply": "Replace the button text with a spinner icon"
}
```

---

### Get App Context

```
GET /api/v1/context
```

**Response:**

```json
{
  "route": "/settings/profile",
  "routeName": "settings-profile",
  "pageComponent": "SettingsProfile",
  "piniaStores": ["userStore", "settingsStore"]
}
```

---

### Query Component

```
GET /api/v1/component?selector=.user-card&name=UserCard
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | `string?` | CSS selector to query |
| `name` | `string?` | Vue component name |

**Response:** Component metadata including name, file path, props, and component chain.

---

### List Webhooks

```
GET /api/v1/webhooks
```

**Response:** Array of configured webhook endpoints with their event filters.

---

### Webhook Deliveries

```
GET /api/v1/webhooks/deliveries
```

**Response:** Recent delivery log entries with status codes, timestamps, and retry counts.

---

### Test Webhook

```
POST /api/v1/webhooks/test
```

Fires a test event to all configured webhooks.

---

### Retry Failed Delivery

```
POST /api/v1/webhooks/retry
Content-Type: application/json
```

```json
{
  "deliveryId": "del_abc123"
}
```

---

### Batch Copied Event

```
POST /api/v1/webhooks/batch-copied
```

Fires the `annotation.batch_copied` webhook event.

---

## WebSocket

Connect to `ws://localhost:3742/ws` for real-time updates. Events are pushed as JSON messages:

```json
{
  "type": "annotation_created",
  "annotation": { ... }
}
```

Event types: `annotation_created`, `annotation_updated`, `annotation_removed`, `annotations_cleared`, `context_updated`, `webhook_delivery`.

## Annotation Object

```ts
interface Annotation {
  id: string
  selector: string
  elementDescription: string
  componentChain: Array<{
    name: string
    file?: string
    line?: number
    propKeys?: string[]
  }>
  feedback: string
  expected?: string
  actual?: string
  elements?: Array<{ selector: string; description: string }>
  areaRect?: { x: number; y: number; width: number; height: number }
  selectedText?: string
  screenshot?: string // base64 PNG
  piniaStores?: string[]
  route?: string
  status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed'
  createdAt: string
  updatedAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  resolvedBy?: string
  resolutionSummary?: string
  dismissReason?: string
  agentQuestion?: string
  agentQuestionAt?: string
  agentQuestionReply?: string
  agentQuestionReplyAt?: string
}
```
