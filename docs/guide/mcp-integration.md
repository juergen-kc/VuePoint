# MCP Integration

VuePoint includes an MCP (Model Context Protocol) server that lets AI coding agents — like Claude Code and Cursor — read, acknowledge, and resolve annotations in real time.

## Setup

### 1. Enable the MCP bridge in your app

```ts
app.use(VuePoint, {
  mcp: {
    enabled: true,
    port: 3742,           // SharedWorker bridge port
    authToken: 'optional', // Bearer token for auth
  },
})
```

### 2. Configure your AI agent

#### Claude Code

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "vuepoint": {
      "command": "./node_modules/.bin/vuepoint-mcp"
    }
  }
}
```

#### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "vuepoint": {
      "command": "./node_modules/.bin/vuepoint-mcp"
    }
  }
}
```

> **Note:** The VuePoint API server must be running for MCP tools to find annotations.
> Start it in a separate terminal: `pnpm dev:vuepoint-api`

## Available Tools

The MCP server exposes 8 tools, all validated with Zod schemas:

### `vuepoint_get_annotations`

Fetch all annotations, optionally filtered by status.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | `'pending' \| 'acknowledged' \| 'resolved' \| 'dismissed' \| 'all'` | `'all'` | Filter by annotation status |

### `vuepoint_get_annotation`

Get a single annotation by ID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Annotation ID |

### `vuepoint_acknowledge`

Mark an annotation as "in progress." The toolbar badge updates to orange.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Annotation ID |

### `vuepoint_resolve`

Mark an annotation as resolved. Fires the `annotation.resolved` webhook event.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Annotation ID |
| `summary` | `string?` | What was changed to fix the issue |
| `resolvedBy` | `string?` | Agent or person name |

### `vuepoint_dismiss`

Archive an annotation as "won't fix."

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Annotation ID |
| `reason` | `string?` | Why it was dismissed |

### `vuepoint_ask`

Send a clarifying question to the user. The question appears as a notification in the toolbar; the user's reply is returned to the agent.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Annotation ID |
| `question` | `string` | The question to ask |

### `vuepoint_get_component_info`

Query the live DOM for component details by CSS selector or component name.

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | `string?` | CSS selector to query |
| `name` | `string?` | Vue component name to search for |

### `vuepoint_get_app_context`

Get the current application context — route path, page component, and active Pinia stores.

No parameters required.

**Returns:**

```json
{
  "route": "/settings/profile",
  "routeName": "settings-profile",
  "pageComponent": "SettingsProfile",
  "piniaStores": ["userStore", "settingsStore"]
}
```

## Agent Workflow

A typical AI agent workflow looks like:

```
1. Agent calls vuepoint_get_annotations({ status: 'pending' })
2. For each annotation:
   a. Agent calls vuepoint_acknowledge({ id })
   b. Agent reads the sfcPath and selector to find the code
   c. Agent fixes the issue
   d. Agent calls vuepoint_resolve({ id, summary: 'Fixed button state' })
```

If the agent needs more context:

```
3. Agent calls vuepoint_ask({ id, question: 'Should the button show a spinner or just disable?' })
4. User replies in the toolbar
5. Agent reads the reply and continues
```

## Architecture

```
Browser Tabs ──postMessage──→ SharedWorker ──fetch()──→ API Server (:3742)
                                                              ↑
                                                        HTTP / fetch
                                                              ↑
                                                      MCP Server (stdio)
                                                              ↑
                                                      AI Agent (Claude/Cursor)
```

The SharedWorker holds canonical annotation state and syncs it to the API server via HTTP. The MCP server reads/writes annotations through the same API. Multiple browser tabs share the same worker instance.
