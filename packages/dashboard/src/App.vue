<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Annotation, AnnotationStatus } from '@vuepoint/core'
import { useApiClient } from './useApiClient'

const client = useApiClient()

// Filters
const statusFilter = ref<AnnotationStatus | 'all'>('all')
const routeFilter = ref('')
const searchQuery = ref('')

const filteredAnnotations = computed(() => {
  let result = client.annotations.value
  if (statusFilter.value !== 'all') {
    result = result.filter(a => a.status === statusFilter.value)
  }
  if (routeFilter.value) {
    result = result.filter(a => a.route === routeFilter.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(a =>
      a.feedback.toLowerCase().includes(q) ||
      a.elementDescription.toLowerCase().includes(q) ||
      a.selector.toLowerCase().includes(q) ||
      (a.resolutionSummary && a.resolutionSummary.toLowerCase().includes(q))
    )
  }
  return result.slice().sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
})

const uniqueRoutes = computed(() => {
  const routes = new Set<string>()
  for (const a of client.annotations.value) {
    if (a.route) routes.add(a.route)
  }
  return Array.from(routes).sort()
})

const stats = computed(() => {
  const all = client.annotations.value
  return {
    total: all.length,
    pending: all.filter(a => a.status === 'pending').length,
    acknowledged: all.filter(a => a.status === 'acknowledged').length,
    resolved: all.filter(a => a.status === 'resolved').length,
    dismissed: all.filter(a => a.status === 'dismissed').length,
  }
})

// Export
const exporting = ref(false)
async function handleExport(format: 'csv' | 'markdown') {
  exporting.value = true
  try {
    const content = await client.exportAnnotations(format, statusFilter.value)
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `annotations.${format === 'csv' ? 'csv' : 'md'}`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // Export error handling is best-effort
  } finally {
    exporting.value = false
  }
}

function statusColor(status: AnnotationStatus): string {
  switch (status) {
    case 'pending': return '#3b82f6'
    case 'acknowledged': return '#f59e0b'
    case 'resolved': return '#22c55e'
    case 'dismissed': return '#6b7280'
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString()
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function chainToString(ann: Annotation): string {
  if (!ann.componentChain || ann.componentChain.length === 0) return ''
  return ann.componentChain.map(c => `<${c.name}>`).join(' → ')
}

// Selected annotation detail
const selectedId = ref<string | null>(null)
const selectedAnnotation = computed(() => {
  if (!selectedId.value) return null
  return client.annotations.value.find(a => a.id === selectedId.value) ?? null
})

onMounted(() => {
  client.connect()
})
</script>

<template>
  <div class="dashboard">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <h1 class="title">VuePoint Dashboard</h1>
        <span
          class="connection-badge"
          :class="{ connected: client.connected.value }"
        >
          {{ client.connected.value ? 'Live' : 'Disconnected' }}
        </span>
      </div>
      <div class="header-right">
        <div v-if="client.context.value.route" class="context-info">
          <span class="context-label">Current Route:</span>
          <code>{{ client.context.value.route }}</code>
          <span v-if="client.context.value.pageComponent" class="context-component">
            ({{ client.context.value.pageComponent }})
          </span>
        </div>
        <button class="btn btn-secondary" :disabled="exporting" @click="handleExport('csv')">
          Export CSV
        </button>
        <button class="btn btn-secondary" :disabled="exporting" @click="handleExport('markdown')">
          Export Markdown
        </button>
      </div>
    </header>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat" @click="statusFilter = 'all'">
        <span class="stat-value">{{ stats.total }}</span>
        <span class="stat-label">Total</span>
      </div>
      <div class="stat" @click="statusFilter = 'pending'">
        <span class="stat-value" style="color: #3b82f6">{{ stats.pending }}</span>
        <span class="stat-label">Pending</span>
      </div>
      <div class="stat" @click="statusFilter = 'acknowledged'">
        <span class="stat-value" style="color: #f59e0b">{{ stats.acknowledged }}</span>
        <span class="stat-label">Acknowledged</span>
      </div>
      <div class="stat" @click="statusFilter = 'resolved'">
        <span class="stat-value" style="color: #22c55e">{{ stats.resolved }}</span>
        <span class="stat-label">Resolved</span>
      </div>
      <div class="stat" @click="statusFilter = 'dismissed'">
        <span class="stat-value" style="color: #6b7280">{{ stats.dismissed }}</span>
        <span class="stat-label">Dismissed</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search annotations..."
        class="filter-input"
      />
      <select v-model="statusFilter" class="filter-select">
        <option value="all">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
      </select>
      <select v-model="routeFilter" class="filter-select">
        <option value="">All Routes</option>
        <option v-for="r in uniqueRoutes" :key="r" :value="r">{{ r }}</option>
      </select>
    </div>

    <!-- Main Content -->
    <div class="content">
      <!-- Annotation List -->
      <div class="annotation-list">
        <div v-if="client.loading.value && filteredAnnotations.length === 0" class="empty-state">
          Loading annotations...
        </div>
        <div v-else-if="client.error.value" class="empty-state error">
          {{ client.error.value }}
          <button class="btn btn-secondary" @click="client.fetchAnnotations()">Retry</button>
        </div>
        <div v-else-if="filteredAnnotations.length === 0" class="empty-state">
          No annotations found.
        </div>
        <div
          v-for="ann in filteredAnnotations"
          :key="ann.id"
          class="annotation-card"
          :class="{ selected: selectedId === ann.id }"
          @click="selectedId = selectedId === ann.id ? null : ann.id"
        >
          <div class="card-header">
            <span class="status-badge" :style="{ backgroundColor: statusColor(ann.status) }">
              {{ ann.status }}
            </span>
            <span class="card-time" :title="formatTime(ann.createdAt)">
              {{ formatRelative(ann.updatedAt) }}
            </span>
          </div>
          <p class="card-feedback">{{ ann.feedback }}</p>
          <div class="card-meta">
            <code class="card-selector" :title="ann.selector">{{ ann.elementDescription }}</code>
            <span v-if="ann.route" class="card-route">{{ ann.route }}</span>
          </div>
          <div v-if="ann.resolutionSummary" class="card-resolution">
            <strong>Resolution:</strong> {{ ann.resolutionSummary }}
          </div>
        </div>
      </div>

      <!-- Detail Panel -->
      <div class="detail-panel" v-if="selectedAnnotation">
        <h2 class="detail-title">Annotation Detail</h2>
        <div class="detail-section">
          <label>Status</label>
          <span class="status-badge large" :style="{ backgroundColor: statusColor(selectedAnnotation.status) }">
            {{ selectedAnnotation.status }}
          </span>
        </div>
        <div class="detail-section">
          <label>Feedback</label>
          <p>{{ selectedAnnotation.feedback }}</p>
        </div>
        <div v-if="selectedAnnotation.expected" class="detail-section">
          <label>Expected</label>
          <p>{{ selectedAnnotation.expected }}</p>
        </div>
        <div v-if="selectedAnnotation.actual" class="detail-section">
          <label>Actual</label>
          <p>{{ selectedAnnotation.actual }}</p>
        </div>
        <div class="detail-section">
          <label>Element</label>
          <code>{{ selectedAnnotation.elementDescription }}</code>
        </div>
        <div class="detail-section">
          <label>Selector</label>
          <code class="code-block">{{ selectedAnnotation.selector }}</code>
        </div>
        <div v-if="chainToString(selectedAnnotation)" class="detail-section">
          <label>Component Chain</label>
          <code class="code-block">{{ chainToString(selectedAnnotation) }}</code>
        </div>
        <div v-if="selectedAnnotation.componentChain?.length" class="detail-section">
          <label>SFC Path</label>
          <code v-if="selectedAnnotation.componentChain[selectedAnnotation.componentChain.length - 1].file">
            {{ selectedAnnotation.componentChain[selectedAnnotation.componentChain.length - 1].file }}
          </code>
        </div>
        <div v-if="selectedAnnotation.route" class="detail-section">
          <label>Route</label>
          <code>{{ selectedAnnotation.route }}</code>
        </div>
        <div v-if="selectedAnnotation.piniaStores?.length" class="detail-section">
          <label>Pinia Stores</label>
          <code>{{ selectedAnnotation.piniaStores.join(', ') }}</code>
        </div>

        <!-- History Timeline -->
        <div class="detail-section">
          <label>History</label>
          <div class="timeline">
            <div class="timeline-item">
              <span class="timeline-dot" style="background: #3b82f6"></span>
              <span>Created {{ formatTime(selectedAnnotation.createdAt) }}</span>
            </div>
            <div v-if="selectedAnnotation.acknowledgedAt" class="timeline-item">
              <span class="timeline-dot" style="background: #f59e0b"></span>
              <span>Acknowledged {{ formatTime(selectedAnnotation.acknowledgedAt) }}</span>
            </div>
            <div v-if="selectedAnnotation.agentQuestion" class="timeline-item">
              <span class="timeline-dot" style="background: #8b5cf6"></span>
              <span>
                Agent asked: "{{ selectedAnnotation.agentQuestion }}"
                <template v-if="selectedAnnotation.agentQuestionAt">
                  ({{ formatTime(selectedAnnotation.agentQuestionAt) }})
                </template>
              </span>
            </div>
            <div v-if="selectedAnnotation.agentQuestionReply" class="timeline-item">
              <span class="timeline-dot" style="background: #8b5cf6"></span>
              <span>
                Reply: "{{ selectedAnnotation.agentQuestionReply }}"
                <template v-if="selectedAnnotation.agentQuestionReplyAt">
                  ({{ formatTime(selectedAnnotation.agentQuestionReplyAt) }})
                </template>
              </span>
            </div>
            <div v-if="selectedAnnotation.resolvedAt" class="timeline-item">
              <span class="timeline-dot" style="background: #22c55e"></span>
              <span>
                Resolved {{ formatTime(selectedAnnotation.resolvedAt) }}
                <template v-if="selectedAnnotation.resolvedBy"> by {{ selectedAnnotation.resolvedBy }}</template>
              </span>
            </div>
            <div v-if="selectedAnnotation.resolutionSummary" class="timeline-item">
              <span class="timeline-dot" style="background: #22c55e"></span>
              <span>Summary: {{ selectedAnnotation.resolutionSummary }}</span>
            </div>
            <div v-if="selectedAnnotation.dismissReason" class="timeline-item">
              <span class="timeline-dot" style="background: #6b7280"></span>
              <span>Dismissed: {{ selectedAnnotation.dismissReason }}</span>
            </div>
            <div class="timeline-item">
              <span class="timeline-dot" style="background: #94a3b8"></span>
              <span>Last updated {{ formatTime(selectedAnnotation.updatedAt) }}</span>
            </div>
          </div>
        </div>

        <div v-if="selectedAnnotation.screenshot" class="detail-section">
          <label>Screenshot</label>
          <img :src="selectedAnnotation.screenshot" class="screenshot-preview" alt="Screenshot" />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Reset & Base */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  line-height: 1.5;
}

.dashboard {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: #f8fafc;
}

.connection-badge {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: #ef4444;
  color: white;
}
.connection-badge.connected {
  background: #22c55e;
}

.context-info {
  font-size: 13px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
}
.context-label {
  font-weight: 500;
}
.context-component {
  color: #64748b;
}

/* Buttons */
.btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-secondary {
  background: #334155;
  color: #e2e8f0;
}
.btn-secondary:hover:not(:disabled) {
  background: #475569;
}

/* Stats Bar */
.stats-bar {
  display: flex;
  gap: 1px;
  background: #334155;
  border-bottom: 1px solid #334155;
}
.stat {
  flex: 1;
  padding: 12px 16px;
  background: #1e293b;
  text-align: center;
  cursor: pointer;
  transition: background 0.15s;
}
.stat:hover {
  background: #253347;
}
.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
}
.stat-label {
  font-size: 12px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Filters */
.filters {
  display: flex;
  gap: 8px;
  padding: 12px 24px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-wrap: wrap;
}
.filter-input,
.filter-select {
  padding: 8px 12px;
  border: 1px solid #334155;
  border-radius: 6px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 13px;
  outline: none;
}
.filter-input:focus,
.filter-select:focus {
  border-color: #3b82f6;
}
.filter-input {
  flex: 1;
  min-width: 200px;
}
.filter-select {
  min-width: 140px;
}

/* Content */
.content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Annotation List */
.annotation-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.annotation-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 14px 16px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.annotation-card:hover {
  border-color: #475569;
}
.annotation-card.selected {
  border-color: #3b82f6;
  background: #1a2744;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.status-badge.large {
  font-size: 13px;
  padding: 4px 12px;
}

.card-time {
  font-size: 12px;
  color: #64748b;
}

.card-feedback {
  font-size: 14px;
  color: #e2e8f0;
  margin-bottom: 8px;
}

.card-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.card-selector {
  font-size: 11px;
  color: #94a3b8;
  background: #0f172a;
  padding: 2px 6px;
  border-radius: 4px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-route {
  font-size: 11px;
  color: #818cf8;
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.card-resolution {
  margin-top: 8px;
  font-size: 13px;
  color: #22c55e;
  border-top: 1px solid #334155;
  padding-top: 8px;
}

/* Detail Panel */
.detail-panel {
  width: 400px;
  flex-shrink: 0;
  border-left: 1px solid #334155;
  background: #1e293b;
  overflow-y: auto;
  padding: 20px;
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #f8fafc;
}

.detail-section {
  margin-bottom: 16px;
}
.detail-section label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.detail-section p {
  font-size: 14px;
  color: #e2e8f0;
}
.detail-section code {
  font-size: 12px;
  color: #94a3b8;
  background: #0f172a;
  padding: 2px 6px;
  border-radius: 4px;
}
.code-block {
  display: block;
  padding: 8px !important;
  word-break: break-all;
  white-space: pre-wrap;
}

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 16px;
  border-left: 2px solid #334155;
}
.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
  position: relative;
}
.timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
  margin-left: -20px;
}

.screenshot-preview {
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid #334155;
}

/* Empty state */
.empty-state {
  text-align: center;
  color: #64748b;
  padding: 40px;
  font-size: 14px;
}
.empty-state.error {
  color: #ef4444;
}
.empty-state .btn {
  margin-top: 12px;
}
</style>
