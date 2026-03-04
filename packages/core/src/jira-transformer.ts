import type { WebhookPayload, Annotation } from './types.js'

// ─── Jira Issue Types ────────────────────────────────────────────────────────

export interface JiraIssuePayload {
  /** Issue fields for the Jira REST API (POST /rest/api/3/issue) */
  fields: {
    summary: string
    description: JiraDocument
    issuetype: { name: string }
    labels: string[]
    priority?: { name: string }
  }
}

/** Jira uses Atlassian Document Format (ADF) for rich content */
export interface JiraDocument {
  type: 'doc'
  version: 1
  content: JiraNode[]
}

export interface JiraNode {
  type: string
  content?: JiraNode[]
  text?: string
  marks?: JiraMarks[]
  attrs?: Record<string, unknown>
}

export interface JiraMarks {
  type: string
  attrs?: Record<string, unknown>
}

export interface JiraTransformerOptions {
  /** Jira issue type name. Default: "Bug" */
  issueType?: string
  /** Labels to auto-apply. Default: ["vuepoint", "ui-feedback"] */
  labels?: string[]
  /** Jira priority name. Default: "Medium" */
  priority?: string
  /** Base URL for "View in VuePoint" links */
  dashboardUrl?: string
  /** Include screenshot in description when available */
  includeScreenshot?: boolean
  /** Jira project key (informational — included in description) */
  projectKey?: string
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
 * Transforms a VuePoint webhook payload into a Jira issue creation payload.
 *
 * Usage with Jira REST API v3:
 * ```ts
 * const issue = toJiraIssue(vuepointPayload, {
 *   issueType: 'Bug',
 *   labels: ['vuepoint'],
 *   projectKey: 'PROJ',
 * })
 *
 * await fetch('https://your-domain.atlassian.net/rest/api/3/issue', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Basic ${btoa(`${email}:${apiToken}`)}`,
 *   },
 *   body: JSON.stringify({
 *     fields: {
 *       project: { key: 'PROJ' },
 *       ...issue.fields,
 *     },
 *   }),
 * })
 * ```
 *
 * Usage with Jira webhook automation:
 * ```ts
 * // In your webhook relay server
 * app.post('/vuepoint-webhook', (req, res) => {
 *   const issue = toJiraIssue(req.body)
 *   // Forward to Jira API...
 * })
 * ```
 */
export function toJiraIssue(
  payload: WebhookPayload,
  options: JiraTransformerOptions = {},
): JiraIssuePayload {
  const {
    issueType = 'Bug',
    labels = ['vuepoint', 'ui-feedback'],
    priority = 'Medium',
    dashboardUrl,
    includeScreenshot = true,
  } = options

  const ann = payload.annotation
  const eventLabel = EVENT_LABELS[payload.event] ?? payload.event

  if (!ann) {
    return {
      fields: {
        summary: `[VuePoint] ${eventLabel}`,
        description: buildSessionDoc(payload, eventLabel),
        issuetype: { name: issueType },
        labels,
        priority: { name: priority },
      },
    }
  }

  return {
    fields: {
      summary: deriveTitle(ann),
      description: buildAnnotationDoc(payload, ann, eventLabel, {
        dashboardUrl,
        includeScreenshot,
      }),
      issuetype: { name: issueType },
      labels,
      priority: { name: priority },
    },
  }
}

// ─── ADF Builder Helpers ─────────────────────────────────────────────────────

function text(value: string, marks?: JiraMarks[]): JiraNode {
  const node: JiraNode = { type: 'text', text: value }
  if (marks && marks.length > 0) node.marks = marks
  return node
}

function bold(value: string): JiraNode {
  return text(value, [{ type: 'strong' }])
}

function code(value: string): JiraNode {
  return text(value, [{ type: 'code' }])
}

function link(value: string, href: string): JiraNode {
  return text(value, [{ type: 'link', attrs: { href } }])
}

function paragraph(...children: JiraNode[]): JiraNode {
  return { type: 'paragraph', content: children }
}

function heading(level: number, value: string): JiraNode {
  return { type: 'heading', attrs: { level }, content: [text(value)] }
}

function blockquote(...children: JiraNode[]): JiraNode {
  return { type: 'blockquote', content: children }
}

function rule(): JiraNode {
  return { type: 'rule' }
}

function tableRow(...cells: JiraNode[]): JiraNode {
  return { type: 'tableRow', content: cells }
}

function tableHeader(...children: JiraNode[]): JiraNode {
  return { type: 'tableHeader', content: [paragraph(...children)] }
}

function tableCell(...children: JiraNode[]): JiraNode {
  return { type: 'tableCell', content: [paragraph(...children)] }
}

function table(...rows: JiraNode[]): JiraNode {
  return { type: 'table', attrs: { layout: 'default' }, content: rows }
}

// ─── Document Builders ───────────────────────────────────────────────────────

function deriveTitle(ann: Annotation): string {
  const firstSentence = ann.feedback.split(/[.!?\n]/)[0].trim()
  const title = firstSentence.length > 80
    ? firstSentence.slice(0, 77) + '...'
    : firstSentence
  return `[VuePoint] ${title}`
}

function buildSessionDoc(
  payload: WebhookPayload,
  eventLabel: string,
): JiraDocument {
  const content: JiraNode[] = [heading(2, eventLabel)]

  const fields: JiraNode[][] = []
  if (payload.meta.appName) fields.push([bold('App: '), text(payload.meta.appName)])
  if (payload.meta.appVersion) fields.push([bold('Version: '), text(payload.meta.appVersion)])
  fields.push([bold('Session: '), text(payload.meta.sessionId)])
  fields.push([bold('Time: '), text(payload.timestamp)])

  for (const field of fields) {
    content.push(paragraph(...field))
  }

  return { type: 'doc', version: 1, content }
}

function buildAnnotationDoc(
  payload: WebhookPayload,
  ann: Annotation,
  eventLabel: string,
  opts: { dashboardUrl?: string; includeScreenshot: boolean },
): JiraDocument {
  const status = STATUS_LABELS[ann.status] ?? ann.status
  const content: JiraNode[] = []

  // Header
  content.push(heading(2, eventLabel))

  // Feedback blockquote
  content.push(blockquote(paragraph(text(ann.feedback))))

  // Structured fields table
  const rows: JiraNode[] = [
    tableRow(tableHeader(bold('Field')), tableHeader(bold('Value'))),
    tableRow(tableCell(text('Status')), tableCell(text(status))),
    tableRow(tableCell(text('Element')), tableCell(text(ann.elementDescription))),
    tableRow(tableCell(text('Selector')), tableCell(code(ann.selector))),
  ]

  if (ann.route) {
    rows.push(tableRow(tableCell(text('Route')), tableCell(text(ann.route))))
  }

  const sfcPath = ann.componentChain.find(c => c.file)?.file
  if (sfcPath) {
    rows.push(tableRow(tableCell(text('SFC Path')), tableCell(code(sfcPath))))
  }

  content.push(table(...rows))

  // Component chain
  if (ann.componentChain.length > 0) {
    content.push(heading(3, 'Component Chain'))
    const chain = ann.componentChain
      .map(c => c.file ? `<${c.name}> (${c.file})` : `<${c.name}>`)
      .join(' → ')
    content.push(paragraph(text(chain)))
  }

  // Expected / Actual
  if (ann.expected || ann.actual) {
    content.push(heading(3, 'Expected vs Actual'))
    if (ann.expected) content.push(paragraph(bold('Expected: '), text(ann.expected)))
    if (ann.actual) content.push(paragraph(bold('Actual: '), text(ann.actual)))
  }

  // Pinia stores
  if (ann.piniaStores && ann.piniaStores.length > 0) {
    content.push(
      paragraph(bold('Pinia Stores: '), text(ann.piniaStores.map(s => `\`${s}\``).join(', '))),
    )
  }

  // Resolution / Dismissal
  if (ann.resolutionSummary) {
    content.push(paragraph(bold('Resolution: '), text(ann.resolutionSummary)))
  }
  if (ann.dismissReason) {
    content.push(paragraph(bold('Dismissed: '), text(ann.dismissReason)))
  }

  // Screenshot (as media single node)
  if (opts.includeScreenshot && ann.screenshot) {
    const src = ann.screenshot.startsWith('data:')
      ? ann.screenshot
      : `data:image/png;base64,${ann.screenshot}`
    content.push({
      type: 'mediaSingle',
      attrs: { layout: 'center' },
      content: [{
        type: 'media',
        attrs: {
          type: 'external',
          url: src,
          alt: `Screenshot of ${ann.elementDescription}`,
        },
      }],
    })
  }

  // Footer
  content.push(rule())
  const metaParts: string[] = ['VuePoint']
  if (payload.meta.appName) metaParts.push(payload.meta.appName)
  if (payload.meta.appVersion) metaParts.push(`v${payload.meta.appVersion}`)
  const footerParts: JiraNode[] = [text(`${metaParts.join(' · ')} · ${payload.timestamp}`)]

  if (opts.dashboardUrl) {
    const viewUrl = `${opts.dashboardUrl.replace(/\/$/, '')}/annotations/${ann.id}`
    footerParts.push(text(' · '))
    footerParts.push(link('View in VuePoint', viewUrl))
  }

  content.push(paragraph(...footerParts))

  return { type: 'doc', version: 1, content }
}
