/**
 * selector.ts
 *
 * Generates a unique, greppable CSS selector for a given DOM element.
 * Strategy (in order of preference):
 *   1. Unique ID
 *   2. Unique data-testid or data-cy attribute
 *   3. Class-based path (stopping at unique node)
 *   4. Nth-child fallback path
 */

const MAX_DEPTH = 8

/** Attributes we treat as stable anchors (in priority order) */
const ANCHOR_ATTRS = ['data-testid', 'data-cy', 'data-e2e', 'aria-label', 'name', 'role']

function attrSelector(el: Element, attr: string): string | null {
  const val = el.getAttribute(attr)
  if (!val) return null
  // Sanitise: strip quotes, limit length
  const safe = val.replace(/"/g, '').slice(0, 60)
  return `[${attr}="${safe}"]`
}

function classSelector(el: Element): string {
  // Filter out dynamic/generated classes (Tailwind JIT hashes, CSS modules, etc.)
  // Heuristic: skip classes that are longer than 30 chars or start with a digit
  const classes = Array.from(el.classList).filter(
    (c) => c.length <= 30 && !/^\d/.test(c) && !/^[a-f0-9]{5,}$/.test(c)
  )
  return classes.length > 0 ? '.' + classes.join('.') : ''
}

function nthChild(el: Element): string {
  const parent = el.parentElement
  if (!parent) return el.tagName.toLowerCase()
  const idx = Array.from(parent.children).indexOf(el) + 1
  return `${el.tagName.toLowerCase()}:nth-child(${idx})`
}

function isUnique(selector: string, root: Document | Element = document): boolean {
  try {
    return root.querySelectorAll(selector).length === 1
  } catch {
    return false
  }
}

function segmentFor(el: Element): string {
  // 1. Unique ID (skip auto-generated IDs like `:r0:`)
  if (el.id && !/^[:r]/.test(el.id) && isUnique(`#${CSS.escape(el.id)}`)) {
    return `#${CSS.escape(el.id)}`
  }

  // 2. Anchor attributes
  for (const attr of ANCHOR_ATTRS) {
    const sel = attrSelector(el, attr)
    if (sel) return `${el.tagName.toLowerCase()}${sel}`
  }

  // 3. Tag + classes
  const tag = el.tagName.toLowerCase()
  const cls = classSelector(el)
  if (cls) return `${tag}${cls}`

  // 4. Nth-child fallback
  return nthChild(el)
}

export function generateSelector(target: Element): string {
  const segments: string[] = []
  let el: Element | null = target

  for (let depth = 0; el && depth < MAX_DEPTH; depth++) {
    const seg = segmentFor(el)
    segments.unshift(seg)

    const candidate = segments.join(' > ')
    if (isUnique(candidate)) break

    // If we hit a unique anchor (ID or data-testid), stop climbing
    if (seg.startsWith('#') || seg.includes('[data-')) break

    el = el.parentElement
  }

  return segments.join(' > ')
}

/**
 * Returns a human-readable description of the element for display in the
 * annotation output — prefers visible text, falls back to aria/tag/type.
 */
export function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase()

  // Text content (capped)
  const text = el.textContent?.trim().slice(0, 80)
  if (text) return `<${tag}> "${text}"`

  // Aria label
  const aria = el.getAttribute('aria-label')
  if (aria) return `<${tag}> [${aria}]`

  // Input type/placeholder
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type || 'text'
    const placeholder = (el as HTMLInputElement).placeholder
    return placeholder ? `<input[${type}]> "${placeholder}"` : `<input[${type}]>`
  }

  // Image alt
  if (tag === 'img') {
    const alt = (el as HTMLImageElement).alt
    return alt ? `<img> "${alt}"` : '<img>'
  }

  return `<${tag}>`
}
