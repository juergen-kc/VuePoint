# Webhooks

VuePoint can push annotation events to external URLs — Slack channels, Linear projects, Jira boards, or any HTTP endpoint.

## Configuration

```ts
app.use(VuePoint, {
  webhooks: [
    {
      url: 'https://hooks.slack.com/services/T.../B.../xxx',
      secret: 'whsec_my_signing_secret',
      events: ['annotation.created', 'annotation.resolved'],
    },
    {
      url: 'https://my-server.com/vuepoint-webhook',
      // No events filter = receive all events
    },
  ],
})
```

Or via environment variables on the API server:

```bash
export VUEPOINT_WEBHOOKS='[{"url":"https://hooks.slack.com/...","secret":"whsec_...","events":["annotation.created"]}]'
```

## Events

| Event | Fired When |
|-------|------------|
| `annotation.created` | New annotation is created |
| `annotation.updated` | Annotation fields are modified |
| `annotation.acknowledged` | Agent marks annotation as in-progress |
| `annotation.resolved` | Agent marks annotation as fixed |
| `annotation.dismissed` | Agent marks annotation as won't-fix |
| `annotation.batch_copied` | User clicks "Copy All" |
| `session.started` | VuePoint toolbar initializes |
| `session.ended` | Browser tab closes |

## Payload Format

```json
{
  "event": "annotation.created",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "annotation": {
    "id": "abc-123",
    "selector": ".user-form > button.submit",
    "elementDescription": "button \"Save Changes\"",
    "componentChain": [
      { "name": "App", "file": "src/App.vue" },
      { "name": "UserForm", "file": "src/views/UserForm.vue" }
    ],
    "feedback": "Button stays active during loading",
    "expected": "Disabled + spinner while saving",
    "actual": "Triggers duplicate API calls",
    "status": "pending",
    "route": "/settings/profile",
    "piniaStores": ["userStore"],
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  },
  "meta": {
    "appName": "My App",
    "appVersion": "1.0.0",
    "sessionId": "sess_abc123"
  }
}
```

## HMAC Signature Verification

When a `secret` is configured, VuePoint signs each payload with HMAC-SHA256. The signature is sent in the `X-VuePoint-Signature-256` header.

To verify (Node.js example):

```ts
import { createHmac, timingSafeEqual } from 'crypto'

function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = 'sha256=' +
    createHmac('sha256', secret).update(payload).digest('hex')
  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  )
}

// In your webhook handler:
const sig = req.headers['x-vuepoint-signature-256']
const isValid = verifySignature(JSON.stringify(req.body), sig, 'whsec_...')
```

## Retry Policy

Failed deliveries are retried up to 3 times with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1st retry | 1 second |
| 2nd retry | 5 seconds |
| 3rd retry | 30 seconds |

A delivery is considered failed if the response status is not 2xx or the request times out.

## Delivery Log UI

The toolbar settings panel shows webhook delivery history:

- **Event type** and target URL
- **Status code** and timestamp
- **Retry count** for failed deliveries
- **Retry button** to manually re-send a failed delivery

Failed deliveries are highlighted in red for quick identification.

## Slack Integration

VuePoint ships a pre-built Slack Block Kit transformer that converts webhook payloads into rich Slack messages. See the dedicated [Slack Webhook Template](/guide/slack-webhook) page for full details.

Quick setup:

```ts
// webhook-relay.ts — a small relay server
import { toSlackMessage } from '@vuepoint/core'

export function handleVuePointWebhook(payload) {
  const slackPayload = toSlackMessage(payload, {
    dashboardUrl: 'https://dashboard.example.com',
    includeScreenshot: true,
  })

  return fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackPayload),
  })
}
```

## REST API Endpoints

Webhooks can also be managed via the REST API:

```bash
# List configured webhooks
curl http://localhost:3742/api/v1/webhooks

# View delivery history
curl http://localhost:3742/api/v1/webhooks/deliveries

# Test a webhook
curl -X POST http://localhost:3742/api/v1/webhooks/test

# Retry a failed delivery
curl -X POST http://localhost:3742/api/v1/webhooks/retry \
  -H 'Content-Type: application/json' \
  -d '{"deliveryId": "del_abc123"}'
```
