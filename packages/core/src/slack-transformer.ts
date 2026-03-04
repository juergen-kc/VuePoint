import type { WebhookPayload, Annotation } from './types.js'

// ─── Slack Block Kit Types (subset) ─────────────────────────────────────────

export interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn'
  text: string
  emoji?: boolean
}

export interface SlackBlock {
  type: string
  text?: SlackTextObject
  fields?: SlackTextObject[]
  elements?: SlackTextObject[]
  block_id?: string
  image_url?: string
  alt_text?: string
  title?: SlackTextObject
  accessory?: {
    type: string
    image_url?: string
    alt_text?: string
    url?: string
    text?: SlackTextObject
    action_id?: string
  }
}

export interface SlackMessage {
  text: string // fallback for notifications
  blocks: SlackBlock[]
  unfurl_links?: boolean
  unfurl_media?: boolean
}

export interface SlackTransformerOptions {
  /** Base URL for "View in VuePoint" links. Example: "https://dashboard.vuepoint.dev" */
  dashboardUrl?: string
  /** Show screenshot thumbnail in Slack message when available */
  includeScreenshot?: boolean
  /** Custom app name shown in message header. Default: "VuePoint" */
  appLabel?: string
}

// ─── Status Emoji Mapping ───────────────────────────────────────────────────

const STATUS_EMOJI: Record<string, string> = {
  pending: ':large_blue_circle:',
  acknowledged: ':large_orange_circle:',
  resolved: ':white_check_mark:',
  dismissed: ':no_entry_sign:',
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

// ─── Transformer ────────────────────────────────────────────────────────────

/**
 * Transforms a VuePoint webhook payload into a Slack Block Kit message.
 *
 * Usage:
 * ```ts
 * const slackPayload = toSlackMessage(vuepointPayload, { dashboardUrl: 'https://...' })
 * await fetch(SLACK_WEBHOOK_URL, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify(slackPayload),
 * })
 * ```
 */
export function toSlackMessage(
  payload: WebhookPayload,
  options: SlackTransformerOptions = {},
): SlackMessage {
  const { dashboardUrl, includeScreenshot = true, appLabel = 'VuePoint' } = options
  const eventLabel = EVENT_LABELS[payload.event] ?? payload.event

  // Session events (no annotation)
  if (!payload.annotation) {
    return buildSessionMessage(payload, eventLabel, appLabel)
  }

  return buildAnnotationMessage(payload, payload.annotation, eventLabel, {
    dashboardUrl,
    includeScreenshot,
    appLabel,
  })
}

function buildSessionMessage(
  payload: WebhookPayload,
  eventLabel: string,
  appLabel: string,
): SlackMessage {
  const fallback = `[${appLabel}] ${eventLabel}`
  const metaParts: string[] = []
  if (payload.meta.appName) metaParts.push(payload.meta.appName)
  if (payload.meta.appVersion) metaParts.push(`v${payload.meta.appVersion}`)

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${appLabel}* — ${eventLabel}`,
      },
    },
  ]

  if (metaParts.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: metaParts.join(' ') },
        { type: 'mrkdwn', text: new Date(payload.timestamp).toLocaleString() },
      ],
    })
  }

  return { text: fallback, blocks }
}

function buildAnnotationMessage(
  payload: WebhookPayload,
  ann: Annotation,
  eventLabel: string,
  opts: Required<Pick<SlackTransformerOptions, 'includeScreenshot' | 'appLabel'>> & Pick<SlackTransformerOptions, 'dashboardUrl'>,
): SlackMessage {
  const statusEmoji = STATUS_EMOJI[ann.status] ?? ':grey_question:'
  const fallback = `[${opts.appLabel}] ${eventLabel}: ${ann.feedback}`

  const blocks: SlackBlock[] = []

  // Header
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${statusEmoji} *${eventLabel}*\n>${escapeSlack(ann.feedback)}`,
    },
  })

  // Element + Selector + Route fields
  const fields: SlackTextObject[] = []
  fields.push({ type: 'mrkdwn', text: `*Element:*\n${escapeSlack(ann.elementDescription)}` })
  fields.push({ type: 'mrkdwn', text: `*Selector:*\n\`${escapeSlack(ann.selector)}\`` })

  if (ann.route) {
    fields.push({ type: 'mrkdwn', text: `*Route:*\n${escapeSlack(ann.route)}` })
  }

  fields.push({ type: 'mrkdwn', text: `*Status:*\n${statusEmoji} ${ann.status}` })

  blocks.push({ type: 'section', fields })

  // Component chain
  if (ann.componentChain.length > 0) {
    const chain = ann.componentChain
      .map((c) => (c.file ? `\`<${c.name}>\` _(${c.file})_` : `\`<${c.name}>\``))
      .join(' → ')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Component Chain:*\n${chain}` },
    })
  }

  // Expected / Actual
  if (ann.expected || ann.actual) {
    const parts: string[] = []
    if (ann.expected) parts.push(`*Expected:* ${escapeSlack(ann.expected)}`)
    if (ann.actual) parts.push(`*Actual:* ${escapeSlack(ann.actual)}`)
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: parts.join('\n') },
    })
  }

  // Pinia stores
  if (ann.piniaStores && ann.piniaStores.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `*Pinia Stores:* ${ann.piniaStores.map((s) => `\`${s}\``).join(', ')}` },
      ],
    })
  }

  // Screenshot thumbnail
  if (opts.includeScreenshot && ann.screenshot) {
    blocks.push({
      type: 'image',
      image_url: ann.screenshot.startsWith('data:')
        ? ann.screenshot
        : `data:image/png;base64,${ann.screenshot}`,
      alt_text: `Screenshot of ${ann.elementDescription}`,
      title: { type: 'plain_text', text: 'Screenshot', emoji: true },
    })
  }

  // Resolution summary
  if (ann.resolutionSummary) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Resolution:* ${escapeSlack(ann.resolutionSummary)}` },
    })
  }

  // Dismiss reason
  if (ann.dismissReason) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Dismissed:* ${escapeSlack(ann.dismissReason)}` },
    })
  }

  blocks.push({ type: 'divider' })

  // Context footer: app meta + "View in VuePoint" link
  const contextElements: SlackTextObject[] = []
  const metaParts: string[] = [opts.appLabel]
  if (payload.meta.appName) metaParts.push(payload.meta.appName)
  if (payload.meta.appVersion) metaParts.push(`v${payload.meta.appVersion}`)
  contextElements.push({ type: 'mrkdwn', text: metaParts.join(' · ') })
  contextElements.push({ type: 'mrkdwn', text: new Date(payload.timestamp).toLocaleString() })

  blocks.push({ type: 'context', elements: contextElements })

  // "View in VuePoint" button
  if (opts.dashboardUrl) {
    const viewUrl = `${opts.dashboardUrl.replace(/\/$/, '')}/annotations/${ann.id}`
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `<${viewUrl}|View in VuePoint>` },
    })
  }

  return { text: fallback, blocks, unfurl_links: false, unfurl_media: false }
}

/** Escape characters that Slack mrkdwn treats as formatting */
function escapeSlack(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
