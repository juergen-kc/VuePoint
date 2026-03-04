<script setup lang="ts">
/**
 * AnnotationPanel.vue — Stub
 * Scrollable list of all annotations. Full implementation in US-011.
 */
import type { AnnotationsStore } from '../composables/useAnnotations.js'

defineProps<{
  store: AnnotationsStore
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <div data-vuepoint="true" class="vp-panel">
    <slot />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({ name: 'AnnotationPanel' })
</script>
