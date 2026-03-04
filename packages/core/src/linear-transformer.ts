import type { WebhookPayload, Annotation } from './types.js'

// ─── Linear API Types (subset for issue creation) ────────────────────────────

export interface LinearIssuePayload {
  /** Issue title — derived from first sentence of feedback */
  title: string
  /** Full structured annotation as Markdown */
  description: string
  /** Label names to auto-apply */
  labelNames: string[]
  /** Priority: 0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low */
  priority?: number
}

export interface LinearTransformerOptions {
  /** Labels to auto-apply to created issues. Default: ["vuepoint", "ui-feedback"] */
  labels?: string[]
  /** Priority mapping from annotation status. Default: 3 (medium) for new annotations */
  priority?: number
  /** Base URL for "View in VuePoint" links */
  dashboardUrl?: string
  /** Include screenshot in description when available */
  includeScreenshot?: boolean
  /** Team identifier for Linear (informational — included in description footer) */
  teamKey?: string
}

// ─── Status Labels ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: '🔵 Pending',
  acknowledged: '🟠 Acknowledged',
  resolved: '✅ Resolved',
  dismissed: '⛔ Dismissed',
}

const EVENT_LABELS: Record<string, string> = {
  'annotation.created': 'New Annotation',
  'annotation.updated': 'Annotation Updated',
  'annotation.acknowledged': 'Annotation Acknowledged',
  'annotation.resolved': 'Annotation Resolved',
  'annotation.dismissed': 'Annotation Dismissed',
  'annotation.batch_copied': 'Annotations Batch Copied',
  'session.started': 'Session Started',
  'session.ended': 'Session Ended',
}

// ─── Transformer ─────────────────────────────────────────────────────────────

/**
 * Transforms a VuePoint webhook payload into a Linear issue creation payload.
 *
 * Usage with Linear API:
 * ```ts
 * const issue = toLinearIssue(vuepointPayload, { labels: ['vuepoint'] })
 *
 * await fetch('https://api.linear.app/graphql', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${LINEAR_API_KEY}`,
 *   },
 *   body: JSON.stringify({
 *     query: `mutation CreateIssue($input: IssueCreateInput!) {
 *       issueCreate(input: $input) { success issue { id identifier url } }
 *     }`,
 *     variables: {
 *       input: {
 *         teamId: TEAM_ID,
 *         title: issue.title,
 *         description: issue.description,
 *         priority: issue.priority,
 *         labelIds: resolvedLabelIds, // resolve from issue.labelNames
 *       },
 *     },
 *   }),
 * })
 * ```
 *
 * Usage with Linear webhook (incoming):
 * ```ts
 * // In your webhook relay server
 * app.post('/vuepoint-webhook', (req, res) => {
 *   const issue = toLinearIssue(req.body)
 *   // Forward to Linear API...
 * })
 * ```
 */
export function toLinearIssue(
  payload: WebhookPayload,
  options: LinearTransformerOptions = {},
): LinearIssuePayload {
  const {
    labels = ['vuepoint', 'ui-feedback'],
    priority = 3,
    dashboardUrl,
    includeScreenshot = true,
  } = options

  const ann = payload.annotation
  const eventLabel = EVENT_LABELS[payload.event] ?? payload.event

  if (!ann) {
    return {
      title: `[VuePoint] ${eventLabel}`,
      description: buildSessionDescription(payload, eventLabel),
      labelNames: labels,
      priority,
    }
  }

  return {
    title: deriveTitle(ann),
    description: buildAnnotationDescription(payload, ann, eventLabel, {
      dashboardUrl,
      includeScreenshot,
    }),
    labelNames: labels,
    priority,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Derive issue title from the first sentence of annotation feedback */
function deriveTitle(ann: Annotation): string {
  const firstSentence = ann.feedback.split(/[.!?\n]/)[0].trim()
  const title = firstSentence.length > 80
    ? firstSentence.slice(0, 77) + '...'
    : firstSentence
  return `[VuePoint] ${title}`
}

function buildSessionDescription(
  payload: WebhookPayload,
  eventLabel: string,
): string {
  const lines: string[] = [
    `## ${eventLabel}`,
    '',
  ]

  if (payload.meta.appName) lines.push(`**App:** ${payload.meta.appName}`)
  if (payload.meta.appVersion) lines.push(`**Version:** ${payload.meta.appVersion}`)
  lines.push(`**Session:** ${payload.meta.sessionId}`)
  lines.push(`**Time:** ${payload.timestamp}`)

  return lines.join('\n')
}

function buildAnnotationDescription(
  payload: WebhookPayload,
  ann: Annotation,
  eventLabel: string,
  opts: { dashboardUrl?: string; includeScreenshot: boolean },
): string {
  const status = STATUS_LABELS[ann.status] ?? ann.status
  const lines: string[] = []

  // Header
  lines.push(`## ${eventLabel}`)
  lines.push('')

  // Feedback
  lines.push(`> ${ann.feedback}`)
  lines.push('')

  // Structured fields table
  lines.push('| Field | Value |')
  lines.push('|-------|-------|')
  lines.push(`| **Status** | ${status} |`)
  lines.push(`| **Element** | ${ann.elementDescription} |`)
  lines.push(`| **Selector** | \`${ann.selector}\` |`)

  if (ann.route) {
    lines.push(`| **Route** | ${ann.route} |`)
  }

  // SFC path from component chain
  const sfcPath = ann.componentChain.find(c => c.file)?.file
  if (sfcPath) {
    lines.push(`| **SFC Path** | \`${sfcPath}\` |`)
  }

  lines.push('')

  // Component chain
  if (ann.componentChain.length > 0) {
    lines.push('### Component Chain')
    lines.push('')
    lines.push(
      ann.componentChain
        .map(c => c.file ? `\`<${c.name}>\` _(${c.file})_` : `\`<${c.name}>\``)
        .join(' → '),
    )
    lines.push('')
  }

  // Expected / Actual
  if (ann.expected || ann.actual) {
    lines.push('### Expected vs Actual')
    lines.push('')
    if (ann.expected) lines.push(`**Expected:** ${ann.expected}`)
    if (ann.actual) lines.push(`**Actual:** ${ann.actual}`)
    lines.push('')
  }

  // Pinia stores
  if (ann.piniaStores && ann.piniaStores.length > 0) {
    lines.push(`**Pinia Stores:** ${ann.piniaStores.map(s => `\`${s}\``).join(', ')}`)
    lines.push('')
  }

  // Resolution / Dismissal
  if (ann.resolutionSummary) {
    lines.push(`**Resolution:** ${ann.resolutionSummary}`)
    lines.push('')
  }
  if (ann.dismissReason) {
    lines.push(`**Dismissed:** ${ann.dismissReason}`)
    lines.push('')
  }

  // Screenshot
  if (opts.includeScreenshot && ann.screenshot) {
    const src = ann.screenshot.startsWith('data:')
      ? ann.screenshot
      : `data:image/png;base64,${ann.screenshot}`
    lines.push(`![Screenshot](${src})`)
    lines.push('')
  }

  // Footer
  lines.push('---')
  const metaParts: string[] = ['VuePoint']
  if (payload.meta.appName) metaParts.push(payload.meta.appName)
  if (payload.meta.appVersion) metaParts.push(`v${payload.meta.appVersion}`)
  lines.push(`_${metaParts.join(' · ')} · ${payload.timestamp}_`)

  // Dashboard link
  if (opts.dashboardUrl) {
    const viewUrl = `${opts.dashboardUrl.replace(/\/$/, '')}/annotations/${ann.id}`
    lines.push('')
    lines.push(`[View in VuePoint](${viewUrl})`)
  }

  return lines.join('\n')
}
