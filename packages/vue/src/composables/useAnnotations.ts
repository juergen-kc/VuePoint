/**
 * useAnnotations.ts
 *
 * Reactive store for annotation state. Intentionally not Pinia — VuePoint
 * manages its own isolated state to avoid polluting the host app's store.
 *
 * This composable is the single source of truth for all annotations in
 * the current session. The toolbar UI, MCP server, and REST API all read
 * from and write to this same reactive state via the plugin's provide/inject.
 */

import { ref, computed, readonly } from 'vue'
import type { Annotation, AnnotationCreateInput } from '@vuepoint/core'
import { generateId, now } from '@vuepoint/core'

export const VUEPOINT_ANNOTATIONS_KEY = Symbol('vuepoint:annotations')

export function useAnnotationsStore() {
  const annotations = ref<Annotation[]>([])

  // ─── Reads ────────────────────────────────────────────────────────────────

  const pending = computed(() =>
    annotations.value.filter((a) => a.status === 'pending')
  )

  const resolved = computed(() =>
    annotations.value.filter((a) => a.status === 'resolved')
  )

  const all = readonly(annotations)

  function getById(id: string): Annotation | undefined {
    return annotations.value.find((a) => a.id === id)
  }

  // ─── Writes ───────────────────────────────────────────────────────────────

  function create(input: AnnotationCreateInput): Annotation {
    const ann: Annotation = {
      id: generateId(),
      status: 'pending',
      createdAt: now(),
      updatedAt: now(),
      ...input,
    }
    annotations.value.push(ann)
    return ann
  }

  function update(id: string, patch: Partial<Annotation>): Annotation | null {
    const idx = annotations.value.findIndex((a) => a.id === id)
    if (idx === -1) return null
    annotations.value[idx] = { ...annotations.value[idx], ...patch, updatedAt: now() }
    return annotations.value[idx]
  }

  function acknowledge(id: string): Annotation | null {
    return update(id, { status: 'acknowledged', acknowledgedAt: now() })
  }

  function resolve(id: string, summary?: string, resolvedBy?: string): Annotation | null {
    return update(id, {
      status: 'resolved',
      resolvedAt: now(),
      resolvedBy,
      resolutionSummary: summary,
    })
  }

  function dismiss(id: string, reason?: string): Annotation | null {
    return update(id, { status: 'dismissed', dismissReason: reason })
  }

  function remove(id: string): boolean {
    const idx = annotations.value.findIndex((a) => a.id === id)
    if (idx === -1) return false
    annotations.value.splice(idx, 1)
    return true
  }

  function clear(): void {
    annotations.value = []
  }

  return {
    // state
    annotations: all,
    pending,
    resolved,
    // reads
    getById,
    // writes
    create,
    update,
    acknowledge,
    resolve,
    dismiss,
    remove,
    clear,
  }
}

export type AnnotationsStore = ReturnType<typeof useAnnotationsStore>
