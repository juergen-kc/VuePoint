/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { generateSelector, describeElement } from './selector'

/**
 * Test helper: builds DOM from trusted HTML strings.
 * This is safe because these are static test fixtures, not user input.
 */
function setTestDOM(html: string): void {
  document.body.innerHTML = html}

describe('selector.ts', () => {
  beforeEach(() => {
    document.body.innerHTML = ''  })

  describe('generateSelector()', () => {
    it('uses #id when element has a unique ID', () => {
      setTestDOM('<div id="my-element">Hello</div>')
      const el = document.getElementById('my-element')!
      const selector = generateSelector(el)
      expect(selector).toContain('#my-element')
      expect(document.querySelectorAll(selector).length).toBe(1)
    })

    it('skips auto-generated IDs starting with :', () => {
      setTestDOM('<div id=":r0:">Auto</div>')
      const el = document.querySelector('[id=":r0:"]')!
      const selector = generateSelector(el)
      expect(selector).not.toContain(':r0:')
    })

    it('uses data-testid when available', () => {
      setTestDOM('<button data-testid="save-btn">Save</button>')
      const el = document.querySelector('[data-testid="save-btn"]')!
      const selector = generateSelector(el)
      expect(selector).toContain('[data-testid="save-btn"]')
    })

    it('uses data-cy when available', () => {
      setTestDOM('<button data-cy="submit">Submit</button>')
      const el = document.querySelector('[data-cy="submit"]')!
      const selector = generateSelector(el)
      expect(selector).toContain('[data-cy="submit"]')
    })

    it('uses tag + classes when no ID or anchor attr', () => {
      setTestDOM('<div class="container"><button class="primary save">Go</button></div>')
      const el = document.querySelector('button.primary')!
      const selector = generateSelector(el)
      expect(selector).toContain('button.primary.save')
    })

    it('filters out long classes (>30 chars) as likely generated', () => {
      setTestDOM('<div class="a-very-long-generated-class-name-that-exceeds-limit ok">X</div>')
      const el = document.querySelector('div.ok')!
      const selector = generateSelector(el)
      expect(selector).not.toContain('a-very-long-generated-class-name-that-exceeds-limit')
      expect(selector).toContain('ok')
    })

    it('filters out hex-hash classes as likely CSS module outputs', () => {
      setTestDOM('<div class="ab12ef real-class">X</div>')
      const el = document.querySelector('.real-class')!
      const selector = generateSelector(el)
      expect(selector).not.toContain('ab12ef')
      expect(selector).toContain('real-class')
    })

    it('falls back to nth-child when no other distinguisher', () => {
      setTestDOM('<ul><li>One</li><li>Two</li><li>Three</li></ul>')
      const el = document.querySelectorAll('li')[1]!
      const selector = generateSelector(el)
      expect(selector).toContain('nth-child(2)')
    })

    it('respects max depth of 8', () => {
      // Build a 12-level deep DOM
      let html = ''
      for (let i = 0; i < 12; i++) html += `<div class="level-${i}">`
      html += '<span>Deep</span>'
      for (let i = 0; i < 12; i++) html += '</div>'
      setTestDOM(html)

      const el = document.querySelector('span')!
      const selector = generateSelector(el)
      const segments = selector.split(' > ')
      expect(segments.length).toBeLessThanOrEqual(8)
    })

    it('stops climbing when it hits a unique ID anchor', () => {
      // Both sides have identical structure so the algorithm must climb to #wrapper
      setTestDOM('<div class="outer"><div id="wrapper"><div class="inner"><button class="btn">Click</button></div></div><div class="sibling"><div class="inner"><button class="btn">Other</button></div></div></div>')
      const el = document.querySelector('#wrapper button.btn')!
      const selector = generateSelector(el)
      expect(selector).toContain('#wrapper')
      expect(selector).not.toContain('.outer')
    })

    it('stops climbing when it hits a data-testid anchor', () => {
      // Two button.btn elements so the selector isn't unique by itself
      setTestDOM('<div class="outer"><div data-testid="form"><button class="btn">Click</button></div><div><button class="btn">Other</button></div></div>')
      const el = document.querySelector('[data-testid="form"] button.btn')!
      const selector = generateSelector(el)
      expect(selector).toContain('[data-testid="form"]')
    })

    it('handles special characters in ID', () => {
      setTestDOM('<div id="my.element">Hello</div>')
      const el = document.getElementById('my.element')!
      const selector = generateSelector(el)
      expect(document.querySelector(selector)).toBe(el)
    })
  })

  describe('describeElement()', () => {
    it('returns tag + text content for text elements', () => {
      setTestDOM('<button>Save Changes</button>')
      const el = document.querySelector('button')!
      expect(describeElement(el)).toBe('<button> "Save Changes"')
    })

    it('truncates long text content at 80 chars', () => {
      const longText = 'A'.repeat(100)
      setTestDOM(`<p>${longText}</p>`)
      const el = document.querySelector('p')!
      const desc = describeElement(el)
      expect(desc.length).toBeLessThan(100)
      expect(desc).toContain('A'.repeat(80))
    })

    it('uses aria-label when no text content', () => {
      setTestDOM('<button aria-label="Close dialog"></button>')
      const el = document.querySelector('button')!
      expect(describeElement(el)).toBe('<button> [Close dialog]')
    })

    it('describes input with type and placeholder', () => {
      setTestDOM('<input type="email" placeholder="Enter email">')
      const el = document.querySelector('input')!
      expect(describeElement(el)).toBe('<input[email]> "Enter email"')
    })

    it('describes input with just type when no placeholder', () => {
      setTestDOM('<input type="password">')
      const el = document.querySelector('input')!
      expect(describeElement(el)).toBe('<input[password]>')
    })

    it('describes img with alt text', () => {
      setTestDOM('<img alt="User avatar">')
      const el = document.querySelector('img')!
      expect(describeElement(el)).toBe('<img> "User avatar"')
    })

    it('describes img without alt', () => {
      setTestDOM('<img>')
      const el = document.querySelector('img')!
      expect(describeElement(el)).toBe('<img>')
    })

    it('falls back to bare tag name', () => {
      setTestDOM('<div></div>')
      const el = document.querySelector('div')!
      expect(describeElement(el)).toBe('<div>')
    })
  })
})
