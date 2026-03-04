// ─── Annotation Types ────────────────────────────────────────────────────────

export type AnnotationStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed'

export interface VueComponentInfo {
  /** Inferred name: __name (script setup) → name (defineComponent) → SFC filename */
  name: string
  /** Absolute path from project root, e.g. src/views/users/UserCard.vue */
  file?: string
  /** Estimated line range (best-effort from source maps if available) */
  line?: number
  /** Props snapshot — top-level keys only, values redacted for security */
  propKeys?: string[]
}

export interface AnnotationRect {
  x: number
  y: number
  width: number
  height: number
  scrollX: number
  scrollY: number
}

export interface Annotation {
  id: string
  /** Unique CSS selector path to the annotated element */
  selector: string
  /** Human-readable element description (tag, text content, aria-label) */
  elementDescription: string
  /** Ordered component chain: App → Page → ... → LeafComponent */
  componentChain: VueComponentInfo[]
  /** Pinia store IDs the component accesses (opt-in) */
  piniaStores?: string[]
  /** Current Vue Router route path, if available */
  route?: string
  /** User-provided feedback text */
  feedback: string
  /** Optional structured fields */
  expected?: string
  actual?: string
  /** Base64 PNG screenshot of the annotated area (opt-in, Phase 2) */
  screenshot?: string
  status: AnnotationStatus
  createdAt: string
  updatedAt: string
  /** Set when agent acknowledges via MCP */
  acknowledgedAt?: string
  /** Set when agent resolves via MCP */
  resolvedAt?: string
  resolvedBy?: string
  resolutionSummary?: string
  dismissReason?: string
}

export type AnnotationCreateInput = Pick<
  Annotation,
  'selector' | 'elementDescription' | 'componentChain' | 'feedback'
> & Partial<Pick<Annotation, 'piniaStores' | 'route' | 'expected' | 'actual' | 'screenshot'>>

// ─── Webhook Types ────────────────────────────────────────────────────────────

export type WebhookEvent =
  | 'annotation.created'
  | 'annotation.updated'
  | 'annotation.acknowledged'
  | 'annotation.resolved'
  | 'annotation.dismissed'
  | 'annotation.batch_copied'
  | 'session.started'
  | 'session.ended'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  annotation?: Annotation
  meta: {
    appName?: string
    appVersion?: string
    sessionId: string
  }
}

export interface WebhookConfig {
  url: string
  secret?: string
  events?: WebhookEvent[] // undefined = all events
}

// ─── Plugin Config ────────────────────────────────────────────────────────────

export interface VuePointOptions {
  /** Master enable/disable. Default: auto-disabled in production. */
  enabled?: boolean
  /**
   * Component names to exclude from the hierarchy chain.
   * Defaults to a built-in PrimeVue filter list.
   * Pass `false` to disable all filtering.
   * Pass an array to replace the default list entirely.
   */
  filterComponents?: string[] | false
  /** Keyboard shortcut to toggle toolbar. Default: 'ctrl+shift+a' */
  shortcut?: string
  /** Pinia integration — surfaces store IDs in annotations */
  pinia?: {
    enabled: boolean
    /** Pass the Pinia instance created by createPinia() */
    instance?: unknown
  }
  /** MCP server options */
  mcp?: {
    enabled: boolean
    port?: number
    /** Bearer token for auth. Recommended for shared staging environments. */
    authToken?: string
  }
  /** REST API options */
  api?: {
    enabled: boolean
    port?: number
    authToken?: string
    cors?: string[] // allowed origins
  }
  /** Outbound webhooks */
  webhooks?: WebhookConfig[]
  /** App metadata included in webhook payloads */
  appMeta?: {
    name?: string
    version?: string
  }
}

// ─── Output / Markdown ───────────────────────────────────────────────────────

export interface MarkdownOutputOptions {
  /** Include screenshot as base64 img tag (large — off by default) */
  includeScreenshot?: boolean
  /** Include prop keys listing */
  includeProps?: boolean
}
