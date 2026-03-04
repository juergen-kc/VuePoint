# Linear Webhook Template

VuePoint includes a pre-built payload transformer that converts annotation events into Linear issue creation payloads.

## What You Get

Each annotation is transformed into a Linear issue with:

- **Issue title** — derived from the first sentence of the feedback
- **Structured description** — Markdown with element info, selector, component chain, SFC paths
- **Expected vs Actual** fields when present
- **Labels** — auto-applied (default: `vuepoint`, `ui-feedback`)
- **Priority** — configurable (default: Medium)
- **Screenshot** embedded in description when available
- **"View in VuePoint"** link when a dashboard URL is configured

## Setup

### 1. Create a Linear API Key

1. Go to [Linear Settings → API](https://linear.app/settings/api)
2. Create a **Personal API key** or an **OAuth application**
3. Copy the API key

### 2. Create a Relay Server

Linear's API uses GraphQL — use the `toLinearIssue()` transformer in a relay server:

```ts
// relay-server.ts
import Fastify from 'fastify'
import { toLinearIssue } from '@vuepoint/core'
import type { WebhookPayload } from '@vuepoint/core'

const app = Fastify()
const LINEAR_API_KEY = process.env.LINEAR_API_KEY!
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID!

app.post('/vuepoint-to-linear', async (req) => {
  const payload = req.body as WebhookPayload

  const issue = toLinearIssue(payload, {
    labels: ['vuepoint', 'ui-feedback'],
    priority: 3, // 1=urgent, 2=high, 3=medium, 4=low
    dashboardUrl: 'https://vuepoint-dashboard.internal.example.com',
    includeScreenshot: true,
  })

  // Resolve label IDs from names (cache these in production)
  const labelIds = await resolveLabelIds(issue.labelNames)

  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY,
    },
    body: JSON.stringify({
      query: `mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier url }
        }
      }`,
      variables: {
        input: {
          teamId: LINEAR_TEAM_ID,
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          labelIds,
        },
      },
    }),
  })

  return res.json()
})

async function resolveLabelIds(names: string[]): Promise<string[]> {
  // Query Linear for label IDs by name
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY,
    },
    body: JSON.stringify({
      query: `query { issueLabels { nodes { id name } } }`,
    }),
  })
  const data = await res.json() as { data: { issueLabels: { nodes: { id: string; name: string }[] } } }
  const labelMap = new Map(data.data.issueLabels.nodes.map(l => [l.name.toLowerCase(), l.id]))
  return names.map(n => labelMap.get(n.toLowerCase())).filter((id): id is string => !!id)
}

app.listen({ port: 4000 })
```

### 3. Point VuePoint Webhooks at the Relay

```ts
app.use(VuePoint, {
  webhooks: [
    {
      url: 'http://localhost:4000/vuepoint-to-linear',
      secret: 'whsec_my_secret',
      events: ['annotation.created', 'annotation.resolved'],
    },
  ],
})
```

## Transformer API

```ts
import { toLinearIssue } from '@vuepoint/core'
import type { LinearIssuePayload, LinearTransformerOptions, WebhookPayload } from '@vuepoint/core'

const issue: LinearIssuePayload = toLinearIssue(webhookPayload, options?)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `labels` | `string[]` | `["vuepoint", "ui-feedback"]` | Label names to auto-apply to created issues. |
| `priority` | `number` | `3` | Linear priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low. |
| `dashboardUrl` | `string` | — | Base URL for "View in VuePoint" links. |
| `includeScreenshot` | `boolean` | `true` | Include screenshot in Markdown description. |
| `teamKey` | `string` | — | Team identifier (informational, included in description footer). |

### Output Format

```ts
interface LinearIssuePayload {
  title: string        // "[VuePoint] First sentence of feedback"
  description: string  // Full Markdown with structured annotation data
  labelNames: string[] // Label names to resolve to IDs
  priority?: number    // Linear priority number
}
```

## Example Output

For an `annotation.created` event, the Linear issue description renders as:

```markdown
## New Annotation

> Button stays active during loading state

| Field | Value |
|-------|-------|
| **Status** | 🔵 Pending |
| **Element** | button "Save Changes" |
| **Selector** | `.user-form > button.submit` |
| **Route** | /settings/profile |
| **SFC Path** | `src/views/UserForm.vue` |

### Component Chain

`<App>` _(src/App.vue)_ → `<UserForm>` _(src/views/UserForm.vue)_

### Expected vs Actual

**Expected:** Button disabled + spinner while saving
**Actual:** Triggers duplicate API calls

**Pinia Stores:** `userStore`

---
_VuePoint · My App · v1.0.0 · 2025-01-15T10:30:00.000Z_

[View in VuePoint](https://dashboard.example.com/annotations/abc-123)
```

## Filtering Events

Control which events create Linear issues:

```ts
{
  url: 'http://relay:4000/vuepoint-to-linear',
  events: [
    'annotation.created',    // New feedback → new issue
    'annotation.resolved',   // Fixed → update or close issue
  ],
}
```

::: tip
For resolved/dismissed events, consider updating the existing Linear issue instead of creating a new one. Match by annotation ID stored in the issue description or a custom field.
:::
