/**
 * server.ts — VuePoint MCP Server
 *
 * Exposes annotation state to MCP-capable agents (Claude Code, Cursor, etc.)
 * via the Model Context Protocol over stdio.
 *
 * Run standalone:
 *   node packages/mcp/dist/server.js
 *
 * Or configured to auto-start via plugin options.
 * The server communicates with the browser-side SharedWorker via a local
 * HTTP bridge on a fixed port (default: 3742).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

const BRIDGE_URL = process.env.VUEPOINT_BRIDGE_URL ?? 'http://localhost:3742'
const AUTH_TOKEN = process.env.VUEPOINT_AUTH_TOKEN

// ─── HTTP bridge client (talks to the SharedWorker proxy) ────────────────────

async function bridgeRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`VuePoint bridge error ${res.status}: ${text}`)
  }

  return res.json()
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const tools = [
  {
    name: 'vuepoint_get_annotations',
    description:
      'Fetch all annotations from the live Vue app. ' +
      'Returns selector, component chain, SFC file path, Pinia stores, and user feedback. ' +
      'Filter by status: pending | acknowledged | resolved | dismissed | all.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'acknowledged', 'resolved', 'dismissed', 'all'],
          description: 'Filter by annotation status. Default: pending.',
        },
      },
    },
  },
  {
    name: 'vuepoint_get_annotation',
    description: 'Get a single annotation by ID with full details.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Annotation ID (e.g. ann_lp3k9z4f2)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'vuepoint_acknowledge',
    description:
      'Mark an annotation as acknowledged (in-progress). ' +
      'This updates the toolbar badge to show the agent is working on it.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Annotation ID to acknowledge' },
      },
      required: ['id'],
    },
  },
  {
    name: 'vuepoint_resolve',
    description:
      'Mark an annotation as resolved. ' +
      'Optionally include a summary of what was changed so the reporter can verify.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Annotation ID to resolve' },
        summary: { type: 'string', description: 'Brief description of the fix applied' },
        resolvedBy: { type: 'string', description: 'Agent name (e.g. "Claude Code")' },
      },
      required: ['id'],
    },
  },
  {
    name: 'vuepoint_dismiss',
    description: "Mark an annotation as dismissed (won't fix / not a bug).",
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Annotation ID to dismiss' },
        reason: { type: 'string', description: 'Reason for dismissal' },
      },
      required: ['id'],
    },
  },
  {
    name: 'vuepoint_ask',
    description:
      'Send a clarifying question to the annotation author. ' +
      'The question appears in the VuePoint toolbar for the user to answer. ' +
      'Use vuepoint_get_annotation to check for the reply in agentQuestionReply.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Annotation ID to ask about' },
        question: { type: 'string', description: 'The question to ask the user' },
      },
      required: ['id', 'question'],
    },
  },
  {
    name: 'vuepoint_get_component_info',
    description:
      'Query Vue component metadata by CSS selector or component name. ' +
      'Returns component chain, SFC file path, and prop keys.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'CSS selector to inspect' },
        name: { type: 'string', description: 'Component name to search for (e.g. UserCard)' },
      },
    },
  },
  {
    name: 'vuepoint_get_app_context',
    description:
      'Get current app context: active route, page component name, and active Pinia store IDs. ' +
      'Useful for understanding where in the app an annotation was made.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
]

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'vuepoint', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    let result: unknown

    switch (name) {
      case 'vuepoint_get_annotations': {
        const { status } = z
          .object({
            status: z
              .enum(['pending', 'acknowledged', 'resolved', 'dismissed', 'all'])
              .optional()
              .default('pending'),
          })
          .parse(args ?? {})
        result = await bridgeRequest('GET', `/api/v1/annotations?status=${status}`)
        break
      }

      case 'vuepoint_get_annotation': {
        const { id } = z.object({ id: z.string() }).parse(args)
        result = await bridgeRequest('GET', `/api/v1/annotations/${id}`)
        break
      }

      case 'vuepoint_acknowledge': {
        const { id } = z.object({ id: z.string() }).parse(args)
        result = await bridgeRequest('PATCH', `/api/v1/annotations/${id}`, {
          status: 'acknowledged',
        })
        break
      }

      case 'vuepoint_resolve': {
        const { id, summary, resolvedBy } = z
          .object({ id: z.string(), summary: z.string().optional(), resolvedBy: z.string().optional() })
          .parse(args)
        result = await bridgeRequest('PATCH', `/api/v1/annotations/${id}`, {
          status: 'resolved',
          resolutionSummary: summary,
          resolvedBy,
        })
        break
      }

      case 'vuepoint_dismiss': {
        const { id, reason } = z
          .object({ id: z.string(), reason: z.string().optional() })
          .parse(args)
        result = await bridgeRequest('PATCH', `/api/v1/annotations/${id}`, {
          status: 'dismissed',
          dismissReason: reason,
        })
        break
      }

      case 'vuepoint_ask': {
        const { id, question } = z
          .object({ id: z.string(), question: z.string() })
          .parse(args)
        result = await bridgeRequest('POST', `/api/v1/annotations/${id}/ask`, { question })
        break
      }

      case 'vuepoint_get_component_info': {
        const { selector, name: componentName } = z
          .object({
            selector: z.string().optional(),
            name: z.string().optional(),
          })
          .parse(args ?? {})
        const qs = selector
          ? `selector=${encodeURIComponent(selector)}`
          : `name=${encodeURIComponent(componentName ?? '')}`
        result = await bridgeRequest('GET', `/api/v1/component?${qs}`)
        break
      }

      case 'vuepoint_get_app_context': {
        result = await bridgeRequest('GET', '/api/v1/context')
        break
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[VuePoint MCP] Server running on stdio')
}

main().catch((err) => {
  console.error('[VuePoint MCP] Fatal:', err)
  process.exit(1)
})
