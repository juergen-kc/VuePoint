<script setup lang="ts">
/**
 * AnnotationMarker.vue — Stub
 * Positioned numbered badge for each annotation. Full implementation in US-010.
 */
import type { Annotation } from '@vuepoint/core'

defineProps<{
  annotation: Annotation
  index: number
}>()
</script>

<template>
  <div data-vuepoint="true" class="vp-marker">
    {{ index }}
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({ name: 'AnnotationMarker' })
</script>
