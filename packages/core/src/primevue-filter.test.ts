import { describe, it, expect } from 'vitest'
import { buildFilter, PRIMEVUE_FILTER, VUE_BUILTINS } from './primevue-filter'

describe('primevue-filter', () => {
  describe('PRIMEVUE_FILTER', () => {
    it('contains 35+ PrimeVue internal component names', () => {
      expect(PRIMEVUE_FILTER.length).toBeGreaterThanOrEqual(35)
    })

    it('includes common PrimeVue internals', () => {
      expect(PRIMEVUE_FILTER).toContain('PVPortal')
      expect(PRIMEVUE_FILTER).toContain('SpinnerIcon')
      expect(PRIMEVUE_FILTER).toContain('PVFocusTrap')
      expect(PRIMEVUE_FILTER).toContain('Ripple')
    })
  })

  describe('VUE_BUILTINS', () => {
    it('includes Vue built-in component names', () => {
      expect(VUE_BUILTINS).toContain('Transition')
      expect(VUE_BUILTINS).toContain('TransitionGroup')
      expect(VUE_BUILTINS).toContain('KeepAlive')
      expect(VUE_BUILTINS).toContain('Suspense')
      expect(VUE_BUILTINS).toContain('Teleport')
    })

    it('includes router components', () => {
      expect(VUE_BUILTINS).toContain('RouterView')
      expect(VUE_BUILTINS).toContain('RouterLink')
    })
  })

  describe('buildFilter()', () => {
    it('returns empty set when option is false', () => {
      const filter = buildFilter(false)
      expect(filter.size).toBe(0)
      expect(filter).toBeInstanceOf(Set)
    })

    it('returns defaults (VUE_BUILTINS + PRIMEVUE_FILTER) when option is undefined', () => {
      const filter = buildFilter(undefined)
      // Must include all Vue builtins
      for (const name of VUE_BUILTINS) {
        expect(filter.has(name)).toBe(true)
      }
      // Must include all PrimeVue internals
      for (const name of PRIMEVUE_FILTER) {
        expect(filter.has(name)).toBe(true)
      }
      expect(filter.size).toBe(new Set([...VUE_BUILTINS, ...PRIMEVUE_FILTER]).size)
    })

    it('merges custom list with VUE_BUILTINS when option is string[]', () => {
      const custom = ['MyInternalComponent', 'AnotherInternal']
      const filter = buildFilter(custom)

      // Custom items included
      expect(filter.has('MyInternalComponent')).toBe(true)
      expect(filter.has('AnotherInternal')).toBe(true)

      // Vue builtins always included
      for (const name of VUE_BUILTINS) {
        expect(filter.has(name)).toBe(true)
      }

      // PrimeVue defaults NOT included when custom list provided
      expect(filter.has('SpinnerIcon')).toBe(false)
      expect(filter.has('Ripple')).toBe(false)
    })

    it('deduplicates entries shared between VUE_BUILTINS and custom list', () => {
      const custom = ['Transition', 'CustomComponent']
      const filter = buildFilter(custom)
      // Transition is in both VUE_BUILTINS and custom — Set deduplicates
      expect(filter.size).toBe(VUE_BUILTINS.length + 1) // +1 for CustomComponent
    })
  })
})
