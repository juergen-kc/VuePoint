/**
 * output.ts
 *
 * Formats one or more annotations as structured Markdown for paste into
 * Claude Code, Cursor, or any AI agent. This is the "structured output"
 * that makes VuePoint useful — greppable selectors, real component names,
 * and SFC file paths so agents can find the exact code without guessing.
 */

import type { Annotation, MarkdownOutputOptions } from './types.js'

// ─── Single annotation ────────────────────────────────────────────────────────

export function formatAnnotation(
  ann: Annotation,
  opts: MarkdownOutputOptions = {}
): string {
  const lines: string[] = []

  // Header
  lines.push(`### Annotation [${ann.id.slice(-6)}]`)
  lines.push('')

  // Element
  lines.push(`**Element:** \`${ann.elementDescription}\``)
  lines.push(`**Selector:** \`${ann.selector}\``)

  // Vue component chain
  if (ann.componentChain.length > 0) {
    const chain = ann.componentChain.map((c) => `<${c.name}>`).join(' → ')
    lines.push(`**Component:** \`${chain}\``)

    // Most specific component with a file path
    const withFile = [...ann.componentChain].reverse().find((c) => c.file)
    if (withFile?.file) {
      const display = withFile.file.replace(/^.*?src\//, 'src/')
      lines.push(`**SFC Path:** \`${display}\``)
    }
  }

  // Pinia stores
  if (ann.piniaStores && ann.piniaStores.length > 0) {
    lines.push(`**Pinia Stores:** \`${ann.piniaStores.join('`, `')}\``)
  }

  // Route
  if (ann.route) {
    lines.push(`**Route:** \`${ann.route}\``)
  }

  // Props (opt-in)
  if (opts.includeProps) {
    const withProps = [...ann.componentChain].reverse().find((c) => c.propKeys?.length)
    if (withProps?.propKeys?.length) {
      lines.push(`**Props:** \`${withProps.propKeys.join('`, `')}\``)
    }
  }

  // Selected text (from text selection annotation)
  if (ann.selectedText) {
    lines.push(`**Selected Text:** \`${ann.selectedText}\``)
  }

  // Multi-element details (from Shift+drag selection)
  if (ann.elements && ann.elements.length > 0) {
    lines.push('')
    lines.push(`**Multi-select:** ${ann.elements.length} elements`)
    for (let i = 0; i < ann.elements.length; i++) {
      const el = ann.elements[i]
      lines.push(`- **[${i + 1}]** \`${el.selector}\` — ${el.elementDescription}`)
    }
  }

  // Area selection details (from Alt+drag)
  if (ann.areaRect) {
    const r = ann.areaRect
    lines.push('')
    lines.push(`**Area:** \`${Math.round(r.width)}×${Math.round(r.height)}\` at \`(${Math.round(r.x)}, ${Math.round(r.y)})\``)
    if (ann.elements && ann.elements.length > 0) {
      lines.push(`**Elements within area:** ${ann.elements.length}`)
      for (let i = 0; i < ann.elements.length; i++) {
        const el = ann.elements[i]
        lines.push(`- **[${i + 1}]** \`${el.selector}\` — ${el.elementDescription}`)
      }
    }
  }

  lines.push('')

  // Feedback
  lines.push(`**Feedback:** ${ann.feedback}`)

  if (ann.expected) {
    lines.push('')
    lines.push(`**Expected:** ${ann.expected}`)
  }

  if (ann.actual) {
    lines.push(`**Actual:** ${ann.actual}`)
  }

  // Screenshot (opt-in — large, only for async review)
  if (opts.includeScreenshot && ann.screenshot) {
    lines.push('')
    lines.push(`**Screenshot:**`)
    lines.push(`![annotation](${ann.screenshot})`)
  }

  return lines.join('\n')
}

// ─── Batch (all annotations in session) ──────────────────────────────────────

export function formatAnnotationBatch(
  annotations: Annotation[],
  opts: MarkdownOutputOptions = {}
): string {
  if (annotations.length === 0) return '<!-- No VuePoint annotations -->'

  const pending = annotations.filter((a) => a.status === 'pending')

  const lines: string[] = []
  lines.push('## VuePoint Annotations')
  lines.push('')
  lines.push(`> ${pending.length} pending annotation${pending.length !== 1 ? 's' : ''}`)
  lines.push('')

  for (const ann of pending) {
    lines.push(formatAnnotation(ann, opts))
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

// ─── ID generation ────────────────────────────────────────────────────────────

export function generateId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 7)
  return `ann_${ts}${rand}`
}

export function now(): string {
  return new Date().toISOString()
}
