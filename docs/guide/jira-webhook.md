# Jira Webhook Template

VuePoint includes a pre-built payload transformer that converts annotation events into Jira issue creation payloads using the Atlassian Document Format (ADF).

## What You Get

Each annotation is transformed into a Jira issue with:

- **Issue summary** — derived from the first sentence of the feedback
- **Rich ADF description** — structured content with tables, headings, code blocks
- **Expected vs Actual** fields when present
- **Labels** — auto-applied (default: `vuepoint`, `ui-feedback`)
- **Priority** — configurable (default: Medium)
- **Issue type** — configurable (default: Bug)
- **Screenshot** embedded in description when available
- **"View in VuePoint"** link when a dashboard URL is configured

## Setup

### 1. Create a Jira API Token

1. Go to [Atlassian Account → Security → API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**
3. Copy the token

### 2. Create a Relay Server

Jira's REST API expects Atlassian Document Format — use the `toJiraIssue()` transformer in a relay server:

```ts
// relay-server.ts
import Fastify from 'fastify'
import { toJiraIssue } from '@vuepoint/core'
import type { WebhookPayload } from '@vuepoint/core'

const app = Fastify()
const JIRA_BASE_URL = process.env.JIRA_BASE_URL! // e.g., https://your-domain.atlassian.net
const JIRA_EMAIL = process.env.JIRA_EMAIL!
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY! // e.g., "PROJ"

app.post('/vuepoint-to-jira', async (req) => {
  const payload = req.body as WebhookPayload

  const issue = toJiraIssue(payload, {
    issueType: 'Bug',
    labels: ['vuepoint', 'ui-feedback'],
    priority: 'Medium', // Jira priority name: Highest, High, Medium, Low, Lowest
    dashboardUrl: 'https://vuepoint-dashboard.internal.example.com',
    includeScreenshot: true,
  })

  const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`)}`,
    },
    body: JSON.stringify({
      fields: {
        project: { key: JIRA_PROJECT_KEY },
        ...issue.fields,
      },
    }),
  })

  return res.json()
})

app.listen({ port: 4000 })
```

### 3. Point VuePoint Webhooks at the Relay

```ts
app.use(VuePoint, {
  webhooks: [
    {
      url: 'http://localhost:4000/vuepoint-to-jira',
      secret: 'whsec_my_secret',
      events: ['annotation.created', 'annotation.resolved'],
    },
  ],
})
```

## Transformer API

```ts
import { toJiraIssue } from '@vuepoint/core'
import type { JiraIssuePayload, JiraTransformerOptions, WebhookPayload } from '@vuepoint/core'

const issue: JiraIssuePayload = toJiraIssue(webhookPayload, options?)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `issueType` | `string` | `"Bug"` | Jira issue type name (Bug, Task, Story, etc.). |
| `labels` | `string[]` | `["vuepoint", "ui-feedback"]` | Labels to auto-apply to created issues. |
| `priority` | `string` | `"Medium"` | Jira priority name (Highest, High, Medium, Low, Lowest). |
| `dashboardUrl` | `string` | — | Base URL for "View in VuePoint" links. |
| `includeScreenshot` | `boolean` | `true` | Include screenshot in ADF description. |
| `projectKey` | `string` | — | Jira project key (informational, included in description). |

### Output Format

```ts
interface JiraIssuePayload {
  fields: {
    summary: string        // "[VuePoint] First sentence of feedback"
    description: JiraDocument // Atlassian Document Format
    issuetype: { name: string }
    labels: string[]
    priority?: { name: string }
  }
}
```

The `description` field uses [Atlassian Document Format (ADF)](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) — a structured JSON format that Jira renders as rich content with tables, headings, code blocks, and links.

## Example

For an `annotation.created` event, the Jira issue renders with:

- **Summary:** `[VuePoint] Button stays active during loading state`
- **Description:** Rich ADF document containing:
  - Feedback blockquote
  - Structured fields table (status, element, selector, route, SFC path)
  - Component chain section
  - Expected vs Actual section
  - Pinia stores
  - Footer with metadata and VuePoint link

## Filtering Events

Control which events create Jira issues:

```ts
{
  url: 'http://relay:4000/vuepoint-to-jira',
  events: [
    'annotation.created',    // New feedback → new Jira issue
    'annotation.resolved',   // Fixed → update or transition issue
  ],
}
```

::: tip
For resolved/dismissed events, consider transitioning the existing Jira issue instead of creating a new one. Use Jira's transition API (`POST /rest/api/3/issue/{issueIdOrKey}/transitions`) to move issues to "Done" when an annotation is resolved.
:::

## Jira Server vs Cloud

The `toJiraIssue()` transformer outputs Jira REST API v3 format (ADF descriptions), which is supported by:

- **Jira Cloud** — fully supported
- **Jira Server/Data Center 8.x+** — supported with REST API v3 enabled

For older Jira Server instances using REST API v2 (wiki markup descriptions), you'll need a custom transformer.
