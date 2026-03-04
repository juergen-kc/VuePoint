import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatAnnotation, formatAnnotationBatch, generateId, now } from './output'
import type { Annotation } from './types'

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'ann_test123abc',
    selector: '.my-component > button.primary',
    elementDescription: '<button> "Save"',
    componentChain: [
      { name: 'App' },
      { name: 'UserView', file: 'src/views/UserView.vue' },
      { name: 'SaveButton', file: 'src/components/SaveButton.vue' },
    ],
    feedback: 'Button stays active during loading state',
    status: 'pending',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('output.ts', () => {
  describe('formatAnnotation()', () => {
    it('includes element description and selector', () => {
      const result = formatAnnotation(makeAnnotation())
      expect(result).toContain('**Element:** `<button> "Save"`')
      expect(result).toContain('**Selector:** `.my-component > button.primary`')
    })

    it('includes component chain in root-to-leaf order', () => {
      const result = formatAnnotation(makeAnnotation())
      expect(result).toContain('**Component:** `<App> → <UserView> → <SaveButton>`')
    })

    it('includes SFC path from most specific component with a file', () => {
      const result = formatAnnotation(makeAnnotation())
      expect(result).toContain('**SFC Path:** `src/components/SaveButton.vue`')
    })

    it('strips absolute prefix from SFC path, keeping src/', () => {
      const ann = makeAnnotation({
        componentChain: [
          { name: 'App' },
          { name: 'UserView', file: '/Users/dev/project/src/views/UserView.vue' },
        ],
      })
      const result = formatAnnotation(ann)
      expect(result).toContain('**SFC Path:** `src/views/UserView.vue`')
    })

    it('includes feedback text', () => {
      const result = formatAnnotation(makeAnnotation())
      expect(result).toContain('**Feedback:** Button stays active during loading state')
    })

    it('includes expected and actual when present', () => {
      const ann = makeAnnotation({
        expected: 'Button disabled + spinner while loading',
        actual: 'Triggers duplicate API calls',
      })
      const result = formatAnnotation(ann)
      expect(result).toContain('**Expected:** Button disabled + spinner while loading')
      expect(result).toContain('**Actual:** Triggers duplicate API calls')
    })

    it('omits expected and actual when not present', () => {
      const result = formatAnnotation(makeAnnotation())
      expect(result).not.toContain('**Expected:**')
      expect(result).not.toContain('**Actual:**')
    })

    it('includes Pinia stores when present', () => {
      const ann = makeAnnotation({ piniaStores: ['usersStore', 'authStore'] })
      const result = formatAnnotation(ann)
      expect(result).toContain('**Pinia Stores:**')
      expect(result).toContain('usersStore')
      expect(result).toContain('authStore')
    })

    it('omits Pinia stores when empty or not present', () => {
      const result = formatAnnotation(makeAnnotation())
      expect(result).not.toContain('Pinia Stores')

      const resultEmpty = formatAnnotation(makeAnnotation({ piniaStores: [] }))
      expect(resultEmpty).not.toContain('Pinia Stores')
    })

    it('includes route when present', () => {
      const ann = makeAnnotation({ route: '/users/123' })
      const result = formatAnnotation(ann)
      expect(result).toContain('**Route:** `/users/123`')
    })

    it('omits route when not present', () => {
      const result = formatAnnotation(makeAnnotation())
      expect(result).not.toContain('**Route:**')
    })

    it('includes selected text when present', () => {
      const ann = makeAnnotation({ selectedText: 'Lorem ipsum' })
      const result = formatAnnotation(ann)
      expect(result).toContain('**Selected Text:** `Lorem ipsum`')
    })

    it('includes props when opt-in and present', () => {
      const ann = makeAnnotation({
        componentChain: [
          { name: 'App' },
          { name: 'MyButton', file: 'src/MyButton.vue', propKeys: ['label', 'disabled'] },
        ],
      })
      const result = formatAnnotation(ann, { includeProps: true })
      expect(result).toContain('**Props:**')
      expect(result).toContain('label')
      expect(result).toContain('disabled')
    })

    it('omits props when not opted in', () => {
      const ann = makeAnnotation({
        componentChain: [
          { name: 'MyButton', file: 'src/MyButton.vue', propKeys: ['label'] },
        ],
      })
      const result = formatAnnotation(ann)
      expect(result).not.toContain('**Props:**')
    })

    it('includes screenshot when opt-in and present', () => {
      const ann = makeAnnotation({ screenshot: 'data:image/png;base64,ABC123' })
      const result = formatAnnotation(ann, { includeScreenshot: true })
      expect(result).toContain('**Screenshot:**')
      expect(result).toContain('![annotation](data:image/png;base64,ABC123)')
    })

    it('omits screenshot when not opted in', () => {
      const ann = makeAnnotation({ screenshot: 'data:image/png;base64,ABC123' })
      const result = formatAnnotation(ann)
      expect(result).not.toContain('Screenshot')
    })

    it('handles empty component chain', () => {
      const ann = makeAnnotation({ componentChain: [] })
      const result = formatAnnotation(ann)
      expect(result).not.toContain('**Component:**')
      expect(result).not.toContain('**SFC Path:**')
    })

    it('includes multi-element details', () => {
      const ann = makeAnnotation({
        elements: [
          { selector: '.btn-1', elementDescription: '<button> "One"', componentChain: [] },
          { selector: '.btn-2', elementDescription: '<button> "Two"', componentChain: [] },
        ],
      })
      const result = formatAnnotation(ann)
      expect(result).toContain('**Multi-select:** 2 elements')
      expect(result).toContain('`.btn-1`')
      expect(result).toContain('`.btn-2`')
    })

    it('includes area selection details', () => {
      const ann = makeAnnotation({
        areaRect: { x: 10, y: 20, width: 300, height: 200, scrollX: 0, scrollY: 0 },
      })
      const result = formatAnnotation(ann)
      expect(result).toContain('**Area:** `300×200` at `(10, 20)`')
    })

    it('includes annotation ID header with last 6 chars of ID', () => {
      const result = formatAnnotation(makeAnnotation({ id: 'ann_xyzabc123' }))
      expect(result).toContain('### Annotation [abc123]')
    })
  })

  describe('formatAnnotationBatch()', () => {
    it('returns empty comment for empty array', () => {
      const result = formatAnnotationBatch([])
      expect(result).toBe('<!-- No VuePoint annotations -->')
    })

    it('formats multiple pending annotations with numbered headers', () => {
      const annotations = [
        makeAnnotation({ id: 'ann_001abc', feedback: 'Issue 1' }),
        makeAnnotation({ id: 'ann_002def', feedback: 'Issue 2' }),
      ]
      const result = formatAnnotationBatch(annotations)
      expect(result).toContain('## VuePoint Annotations')
      expect(result).toContain('> 2 pending annotations')
      expect(result).toContain('Issue 1')
      expect(result).toContain('Issue 2')
      expect(result).toContain('---')
    })

    it('only includes pending annotations', () => {
      const annotations = [
        makeAnnotation({ id: 'ann_001abc', feedback: 'Pending one', status: 'pending' }),
        makeAnnotation({ id: 'ann_002def', feedback: 'Resolved one', status: 'resolved' }),
        makeAnnotation({ id: 'ann_003ghi', feedback: 'Dismissed one', status: 'dismissed' }),
      ]
      const result = formatAnnotationBatch(annotations)
      expect(result).toContain('> 1 pending annotation')
      expect(result).toContain('Pending one')
      expect(result).not.toContain('Resolved one')
      expect(result).not.toContain('Dismissed one')
    })

    it('uses singular "annotation" for count of 1', () => {
      const annotations = [makeAnnotation()]
      const result = formatAnnotationBatch(annotations)
      expect(result).toContain('> 1 pending annotation')
      expect(result).not.toContain('annotations')
    })
  })

  describe('generateId()', () => {
    it('starts with "ann_" prefix', () => {
      expect(generateId()).toMatch(/^ann_/)
    })

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()))
      expect(ids.size).toBe(100)
    })
  })

  describe('now()', () => {
    it('returns an ISO 8601 string', () => {
      const timestamp = now()
      expect(() => new Date(timestamp)).not.toThrow()
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })
})
