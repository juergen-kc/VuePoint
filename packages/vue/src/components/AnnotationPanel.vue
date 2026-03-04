<script setup lang="ts">
/**
 * AnnotationPanel.vue
 *
 * Scrollable list of all annotations. Shows number, element description,
 * feedback text, and status badge for each item. Supports delete and
 * scroll-to-element on click.
 */

import { defineOptions } from 'vue'
import type { Annotation } from '@vuepoint/core'
import type { AnnotationsStore } from '../composables/useAnnotations.js'

defineOptions({ name: 'AnnotationPanel' })

const props = defineProps<{
  store: AnnotationsStore
}>()

const emit = defineEmits<{
  close: []
}>()

// ─── Actions ────────────────────────────────────────────────────────────────

function scrollToElement(annotation: Annotation) {
  try {
    const el = document.querySelector(annotation.selector)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  } catch {
    // Invalid selector — ignore
  }
}

function removeAnnotation(id: string) {
  props.store.remove(id)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusLabel(status: Annotation['status']): string {
  switch (status) {
    case 'pending': return 'Pending'
    case 'acknowledged': return 'In Progress'
    case 'resolved': return 'Resolved'
    case 'dismissed': return 'Dismissed'
    default: return status
  }
}
</script>

<template>
  <div data-vuepoint="true" class="vp-panel">
    <!-- Header -->
    <div class="vp-panel-header">
      <span class="vp-panel-title">Annotations</span>
      <button class="vp-btn-ghost" title="Close panel" @click="emit('close')">✕</button>
    </div>

    <!-- Empty state -->
    <div v-if="store.annotations.value.length === 0" class="vp-panel-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a5568" stroke-width="1.5">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
      <p>No annotations yet.</p>
      <p class="vp-panel-empty-hint">Click "Annotate" to start marking elements.</p>
    </div>

    <!-- Annotation list -->
    <div v-else class="vp-panel-list">
      <div
        v-for="(ann, idx) in store.annotations.value"
        :key="ann.id"
        class="vp-panel-item"
        @click="scrollToElement(ann)"
      >
        <!-- Left: number badge -->
        <div class="vp-panel-item-number" :class="`vp-status--${ann.status}`">
          {{ idx + 1 }}
        </div>

        <!-- Center: description + feedback -->
        <div class="vp-panel-item-content">
          <div class="vp-panel-item-element">{{ ann.elementDescription }}</div>
          <div class="vp-panel-item-feedback">{{ ann.feedback }}</div>
          <span class="vp-panel-item-status" :class="`vp-status--${ann.status}`">
            {{ statusLabel(ann.status) }}
          </span>
        </div>

        <!-- Right: delete button -->
        <button
          class="vp-panel-item-delete"
          title="Remove annotation"
          @click.stop="removeAnnotation(ann.id)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Panel container ─────────────────────────────────────────────────────── */
.vp-panel {
  position: fixed;
  bottom: 72px;
  right: 20px;
  width: 380px;
  max-height: 420px;
  background: #1e1e2e;
  border: 1px solid #334155;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.vp-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #16213e;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.vp-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.vp-btn-ghost {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
}
.vp-btn-ghost:hover {
  color: #e2e8f0;
  background: #334155;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.vp-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 20px;
  color: #64748b;
  text-align: center;
}
.vp-panel-empty p {
  margin: 0;
  font-size: 13px;
}
.vp-panel-empty-hint {
  font-size: 12px !important;
  color: #4a5568 !important;
}

/* ── Scrollable list ─────────────────────────────────────────────────────── */
.vp-panel-list {
  overflow-y: auto;
  flex: 1;
  padding: 6px 0;
}
.vp-panel-list::-webkit-scrollbar {
  width: 4px;
}
.vp-panel-list::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}

/* ── List item ───────────────────────────────────────────────────────────── */
.vp-panel-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.1s;
}
.vp-panel-item:hover {
  background: #2d2d4e;
}

/* Number badge */
.vp-panel-item-number {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  color: white;
  margin-top: 2px;
}

/* Content area */
.vp-panel-item-content {
  flex: 1;
  min-width: 0;
}

.vp-panel-item-element {
  font-size: 12px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 2px;
}

.vp-panel-item-feedback {
  font-size: 13px;
  color: #e2e8f0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 4px;
}

.vp-panel-item-status {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 1px 6px;
  border-radius: 4px;
}

/* Delete button */
.vp-panel-item-delete {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: #4a5568;
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
  margin-top: 1px;
}
.vp-panel-item-delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* ── Status colors (shared between badge and label) ──────────────────────── */
.vp-status--pending {
  background: #4f81bd;
  color: white;
}
.vp-status--acknowledged {
  background: #f59e0b;
  color: white;
}
.vp-status--resolved {
  background: #22c55e;
  color: white;
}
.vp-status--dismissed {
  background: #6b7280;
  color: white;
}
</style>
