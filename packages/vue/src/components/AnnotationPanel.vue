<script setup lang="ts">
/**
 * AnnotationPanel.vue
 *
 * Scrollable list of all annotations. Shows number, element description,
 * feedback text, and status badge for each item. Supports delete and
 * scroll-to-element on click.
 */

import { defineOptions, ref, nextTick } from 'vue'
import type { Annotation } from '@vuepoint/core'
import type { AnnotationsStore } from '../composables/useAnnotations.js'

defineOptions({ name: 'AnnotationPanel' })

const props = defineProps<{
  store: AnnotationsStore
}>()

const emit = defineEmits<{
  close: []
  'reply-question': [id: string, reply: string]
}>()

// ─── Inline Editing ─────────────────────────────────────────────────────────

const editingId = ref<string | null>(null)
const editText = ref('')
const editInput = ref<HTMLTextAreaElement | null>(null)

function startEditing(annotation: Annotation) {
  editingId.value = annotation.id
  editText.value = annotation.feedback
  nextTick(() => {
    if (editInput.value) {
      editInput.value.focus()
      editInput.value.select()
    }
  })
}

function saveEdit() {
  if (editingId.value && editText.value.trim()) {
    props.store.update(editingId.value, { feedback: editText.value.trim() })
  }
  editingId.value = null
  editText.value = ''
}

function cancelEdit() {
  editingId.value = null
  editText.value = ''
}

function handleEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    saveEdit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  }
}

// ─── Agent Question Reply ────────────────────────────────────────────────────

const replyingId = ref<string | null>(null)
const replyText = ref('')

function startReply(annotationId: string) {
  replyingId.value = annotationId
  replyText.value = ''
  nextTick(() => {
    // Focus the reply input
    const el = document.querySelector('.vp-reply-input') as HTMLTextAreaElement | null
    el?.focus()
  })
}

function sendReply() {
  if (replyingId.value && replyText.value.trim()) {
    emit('reply-question', replyingId.value, replyText.value.trim())
  }
  replyingId.value = null
  replyText.value = ''
}

function cancelReply() {
  replyingId.value = null
  replyText.value = ''
}

function handleReplyKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendReply()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelReply()
  }
}

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
          <!-- Inline edit mode -->
          <textarea
            v-if="editingId === ann.id"
            ref="editInput"
            v-model="editText"
            class="vp-panel-item-edit"
            rows="2"
            @blur="saveEdit"
            @keydown="handleEditKeydown"
            @click.stop
          />
          <!-- Read mode — double-click to edit -->
          <div
            v-else
            class="vp-panel-item-feedback"
            title="Double-click to edit"
            @dblclick.stop="startEditing(ann)"
          >{{ ann.feedback }}</div>
          <span class="vp-panel-item-status" :class="`vp-status--${ann.status}`">
            {{ statusLabel(ann.status) }}
          </span>

          <!-- Agent question display -->
          <div v-if="ann.agentQuestion" class="vp-question-block" @click.stop>
            <div class="vp-question-header">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>Agent asks:</span>
            </div>
            <div class="vp-question-text">{{ ann.agentQuestion }}</div>

            <!-- Reply display (if already answered) -->
            <div v-if="ann.agentQuestionReply" class="vp-reply-display">
              <span class="vp-reply-label">Your reply:</span>
              <span class="vp-reply-text">{{ ann.agentQuestionReply }}</span>
            </div>

            <!-- Reply input (if not yet answered) -->
            <div v-else-if="replyingId === ann.id" class="vp-reply-form">
              <textarea
                v-model="replyText"
                class="vp-reply-input"
                placeholder="Type your reply…"
                rows="2"
                @keydown="handleReplyKeydown"
                @click.stop
              />
              <div class="vp-reply-actions">
                <button class="vp-btn-ghost vp-btn-sm" @click.stop="cancelReply">Cancel</button>
                <button
                  class="vp-btn-reply"
                  :disabled="!replyText.trim()"
                  @click.stop="sendReply"
                >Reply</button>
              </div>
            </div>

            <!-- Reply button (if not yet answered and not editing) -->
            <button
              v-else
              class="vp-btn-reply-start"
              @click.stop="startReply(ann.id)"
            >Reply to agent</button>
          </div>
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
  background: var(--vp-bg, #1e1e2e);
  border: 1px solid var(--vp-border, #334155);
  border-radius: 12px;
  box-shadow: 0 8px 32px var(--vp-shadow, rgba(0, 0, 0, 0.4));
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
  background: var(--vp-bg-header, #16213e);
  border-bottom: 1px solid var(--vp-border, #334155);
  flex-shrink: 0;
}

.vp-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-text, #e2e8f0);
}

.vp-btn-ghost {
  background: none;
  border: none;
  color: var(--vp-text-faint, #64748b);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
}
.vp-btn-ghost:hover {
  color: var(--vp-text, #e2e8f0);
  background: var(--vp-border, #334155);
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.vp-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 20px;
  color: var(--vp-text-faint, #64748b);
  text-align: center;
}
.vp-panel-empty p {
  margin: 0;
  font-size: 13px;
}
.vp-panel-empty-hint {
  font-size: 12px !important;
  color: var(--vp-text-hint, #4a5568) !important;
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
  background: var(--vp-border, #334155);
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
  background: var(--vp-bg-hover, #2d2d4e);
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
  color: var(--vp-text-muted, #94a3b8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 2px;
}

.vp-panel-item-feedback {
  font-size: 13px;
  color: var(--vp-text, #e2e8f0);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 4px;
  cursor: text;
  border-radius: 4px;
  padding: 1px 2px;
  margin: -1px -2px 4px;
}
.vp-panel-item-feedback:hover {
  background: var(--vp-border, #334155);
}

.vp-panel-item-edit {
  font-size: 13px;
  font-family: inherit;
  color: var(--vp-text, #e2e8f0);
  background: var(--vp-bg, #1e1e2e);
  border: 1px solid var(--vp-accent, #60a5fa);
  border-radius: 4px;
  padding: 4px 6px;
  margin-bottom: 4px;
  width: 100%;
  resize: vertical;
  line-height: 1.4;
  outline: none;
  box-sizing: border-box;
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
  color: var(--vp-text-hint, #4a5568);
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
  margin-top: 1px;
}
.vp-panel-item-delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* ── Agent question block ────────────────────────────────────────────────── */
.vp-question-block {
  margin-top: 6px;
  padding: 8px 10px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 6px;
  cursor: default;
}

.vp-question-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #f59e0b;
  margin-bottom: 4px;
}

.vp-question-text {
  font-size: 12px;
  color: var(--vp-text, #e2e8f0);
  line-height: 1.4;
  margin-bottom: 6px;
}

.vp-reply-display {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(245, 158, 11, 0.15);
}

.vp-reply-label {
  font-size: 10px;
  font-weight: 600;
  color: #22c55e;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.vp-reply-text {
  display: block;
  font-size: 12px;
  color: var(--vp-text, #e2e8f0);
  margin-top: 2px;
  line-height: 1.4;
}

.vp-reply-form {
  margin-top: 4px;
}

.vp-reply-input {
  width: 100%;
  font-size: 12px;
  font-family: inherit;
  color: var(--vp-text, #e2e8f0);
  background: var(--vp-bg, #1e1e2e);
  border: 1px solid #f59e0b;
  border-radius: 4px;
  padding: 4px 6px;
  resize: vertical;
  line-height: 1.4;
  outline: none;
  box-sizing: border-box;
}

.vp-reply-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
}

.vp-btn-sm {
  font-size: 11px;
  padding: 2px 6px;
}

.vp-btn-reply {
  height: 24px;
  padding: 0 10px;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.vp-btn-reply:hover:not(:disabled) { background: #d97706; }
.vp-btn-reply:disabled { opacity: 0.4; cursor: not-allowed; }

.vp-btn-reply-start {
  display: inline-block;
  height: 22px;
  padding: 0 8px;
  background: transparent;
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.vp-btn-reply-start:hover {
  background: rgba(245, 158, 11, 0.1);
  border-color: #f59e0b;
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
