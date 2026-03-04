# Slack Webhook Template

VuePoint includes a pre-built payload transformer that converts annotation events into Slack Block Kit messages with rich formatting.

## What You Get

Each annotation appears as a Slack message with:

- **Status badge** — color-coded emoji (:large_blue_circle: pending, :large_orange_circle: acknowledged, :white_check_mark: resolved, :no_entry_sign: dismissed)
- **Element description** and CSS selector
- **Component chain** with SFC file paths
- **Feedback text** with optional Expected/Actual fields
- **Pinia stores** referenced by the component
- **Screenshot thumbnail** when available
- **"View in VuePoint"** link when a dashboard URL is configured

## Setup

### 1. Create a Slack Incoming Webhook

1. Go to [Slack API: Incoming Webhooks](https://api.slack.com/messaging/webhooks)
2. Create a new app (or use an existing one)
3. Enable **Incoming Webhooks** and add one to your channel
4. Copy the webhook URL (e.g., `https://hooks.slack.com/services/T.../B.../xxx`)

### 2. Create a Relay Server

Slack incoming webhooks expect the Block Kit payload format — they don't understand VuePoint's native format. Use the `toSlackMessage()` transformer in a small relay:

```ts
// relay-server.ts
import Fastify from 'fastify'
import { toSlackMessage } from '@vuepoint/core'
import type { WebhookPayload } from '@vuepoint/core'

const app = Fastify()
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL!

app.post('/vuepoint-to-slack', async (req) => {
  const payload = req.body as WebhookPayload

  const slackMessage = toSlackMessage(payload, {
    // Optional: link annotations to your VuePoint dashboard
    dashboardUrl: 'https://vuepoint-dashboard.internal.example.com',
    // Include screenshot thumbnails (default: true)
    includeScreenshot: true,
    // Custom label in message header (default: "VuePoint")
    appLabel: 'VuePoint',
  })

  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackMessage),
  })

  return { ok: res.ok, status: res.status }
})

app.listen({ port: 4000 })
```

### 3. Point VuePoint Webhooks at the Relay

```ts
// In your Vue app
app.use(VuePoint, {
  webhooks: [
    {
      url: 'http://localhost:4000/vuepoint-to-slack',
      secret: 'whsec_my_secret',
      events: ['annotation.created', 'annotation.resolved'],
    },
  ],
})
```

Or via environment variable on the API server:

```bash
export VUEPOINT_WEBHOOKS='[{
  "url": "http://localhost:4000/vuepoint-to-slack",
  "secret": "whsec_my_secret",
  "events": ["annotation.created", "annotation.resolved"]
}]'
```

## Transformer API

```ts
import { toSlackMessage } from '@vuepoint/core'
import type { SlackMessage, SlackTransformerOptions, WebhookPayload } from '@vuepoint/core'

const slackPayload: SlackMessage = toSlackMessage(webhookPayload, options?)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dashboardUrl` | `string` | — | Base URL for "View in VuePoint" links. Annotation ID is appended. |
| `includeScreenshot` | `boolean` | `true` | Include screenshot thumbnail when the annotation has one. |
| `appLabel` | `string` | `"VuePoint"` | Custom app name shown in the message header. |

### Output Format

The returned `SlackMessage` has this structure:

```ts
interface SlackMessage {
  text: string          // Plain-text fallback for notifications
  blocks: SlackBlock[]  // Block Kit blocks array
  unfurl_links?: boolean
  unfurl_media?: boolean
}
```

## Example Output

For an `annotation.created` event, the Slack message renders as:

```
🔵 New Annotation
> Button stays active during loading state

Element:              button "Save Changes"
Selector:             .user-form > button.submit
Route:                /settings/profile
Status:               🔵 pending

Component Chain:
<App> (src/App.vue) → <UserForm> (src/views/UserForm.vue)

Expected: Button disabled + spinner while saving
Actual: Triggers duplicate API calls

Pinia Stores: userStore

─────────────────────────────────
VuePoint · My App · v1.0.0    1/15/2025, 10:30:00 AM
View in VuePoint
```

## Screenshots

When `includeScreenshot` is `true` and the annotation has a `screenshot` field (Base64 PNG), the transformer includes it as a Slack `image` block.

::: tip
Slack has a [file size limit](https://api.slack.com/reference/block-kit/blocks#image) for images in Block Kit. If screenshots are too large, consider hosting them on an image server and providing a URL instead of inline Base64.
:::

## Direct Slack Webhook (Without Relay)

If you want to skip the relay server, you can set the Slack webhook URL directly as your VuePoint webhook URL. However, Slack will receive VuePoint's native JSON format — not Block Kit. For rich formatting, use the relay approach above.

## Filtering Events

Control which events reach Slack using the `events` filter:

```ts
{
  url: 'http://relay:4000/vuepoint-to-slack',
  events: [
    'annotation.created',     // New feedback submitted
    'annotation.resolved',    // Agent fixed the issue
    'annotation.dismissed',   // Agent declined the issue
  ],
}
```

Session events (`session.started`, `session.ended`) are also supported — the transformer renders them as simple notification messages.
