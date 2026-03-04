/**
 * Bridge message protocol types.
 *
 * Defines the postMessage contract between browser tabs and the SharedWorker.
 * All messages are typed unions discriminated by the `type` field.
 */

import type { Annotation, AnnotationCreateInput } from '@vuepoint/core'

// ─── Tab → Worker messages ──────────────────────────────────────────────────

export type BridgeCommand =
  | { type: 'connect'; tabId: string }
  | { type: 'create'; annotation: AnnotationCreateInput }
  | { type: 'sync'; annotation: Annotation }
  | { type: 'update'; id: string; patch: Partial<Annotation> }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'context'; context: AppContext }
  | { type: 'get_state' }

// ─── Worker → Tab messages ──────────────────────────────────────────────────

export type BridgeEvent =
  | { type: 'state'; annotations: Annotation[]; context: AppContext }
  | { type: 'annotation_created'; annotation: Annotation }
  | { type: 'annotation_updated'; annotation: Annotation }
  | { type: 'annotation_removed'; id: string }
  | { type: 'annotations_cleared' }
  | { type: 'context_updated'; context: AppContext }
  | { type: 'connected'; tabId: string; tabCount: number }

// ─── App context ────────────────────────────────────────────────────────────

export interface AppContext {
  route?: string
  routeName?: string
  pageComponent?: string
  piniaStores?: string[]
}
