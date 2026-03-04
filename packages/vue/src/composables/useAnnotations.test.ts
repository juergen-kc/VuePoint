import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAnnotationsStore } from './useAnnotations'
import type { AnnotationCreateInput } from '@vuepoint/core'

function makeInput(overrides: Partial<AnnotationCreateInput> = {}): AnnotationCreateInput {
  return {
    selector: '.test-element',
    elementDescription: '<button> "Test"',
    componentChain: [{ name: 'App' }, { name: 'TestComponent' }],
    feedback: 'Test feedback',
    ...overrides,
  }
}

describe('useAnnotations', () => {
  let store: ReturnType<typeof useAnnotationsStore>

  beforeEach(() => {
    store = useAnnotationsStore()
  })

  describe('create()', () => {
    it('creates an annotation with unique ID and timestamp', () => {
      const ann = store.create(makeInput())
      expect(ann.id).toMatch(/^ann_/)
      expect(ann.createdAt).toBeTruthy()
      expect(ann.updatedAt).toBeTruthy()
    })

    it('sets status to pending on creation', () => {
      const ann = store.create(makeInput())
      expect(ann.status).toBe('pending')
    })

    it('adds annotation to the store', () => {
      store.create(makeInput())
      expect(store.annotations.value.length).toBe(1)
    })

    it('preserves input fields', () => {
      const ann = store.create(makeInput({
        feedback: 'Button broken',
        expected: 'Should work',
        actual: 'Does not work',
        route: '/users',
        piniaStores: ['usersStore'],
      }))
      expect(ann.feedback).toBe('Button broken')
      expect(ann.expected).toBe('Should work')
      expect(ann.actual).toBe('Does not work')
      expect(ann.route).toBe('/users')
      expect(ann.piniaStores).toEqual(['usersStore'])
    })

    it('generates unique IDs for multiple annotations', () => {
      const a1 = store.create(makeInput())
      const a2 = store.create(makeInput())
      expect(a1.id).not.toBe(a2.id)
    })
  })

  describe('computed filters', () => {
    it('pending returns only pending annotations', () => {
      store.create(makeInput({ feedback: 'one' }))
      const ann2 = store.create(makeInput({ feedback: 'two' }))
      store.resolve(ann2.id, 'fixed')

      expect(store.pending.value.length).toBe(1)
      expect(store.pending.value[0].feedback).toBe('one')
    })

    it('resolved returns only resolved annotations', () => {
      const ann = store.create(makeInput())
      store.resolve(ann.id, 'done')

      expect(store.resolved.value.length).toBe(1)
      expect(store.resolved.value[0].status).toBe('resolved')
    })

    it('withUnansweredQuestions filters correctly', () => {
      const ann1 = store.create(makeInput())
      store.update(ann1.id, { agentQuestion: 'What color?' })

      const ann2 = store.create(makeInput())
      store.update(ann2.id, { agentQuestion: 'Which size?', agentQuestionReply: 'Large' })

      expect(store.withUnansweredQuestions.value.length).toBe(1)
      expect(store.withUnansweredQuestions.value[0].id).toBe(ann1.id)
    })
  })

  describe('getById()', () => {
    it('returns annotation by ID', () => {
      const ann = store.create(makeInput({ feedback: 'find me' }))
      const found = store.getById(ann.id)
      expect(found?.feedback).toBe('find me')
    })

    it('returns undefined for non-existent ID', () => {
      expect(store.getById('non-existent')).toBeUndefined()
    })
  })

  describe('update()', () => {
    it('updates annotation fields', () => {
      const ann = store.create(makeInput())
      const updated = store.update(ann.id, { feedback: 'Updated feedback' })
      expect(updated?.feedback).toBe('Updated feedback')
    })

    it('sets updatedAt timestamp', () => {
      const ann = store.create(makeInput())
      const originalUpdatedAt = ann.updatedAt

      // Small delay to ensure different timestamp
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValueOnce('2025-06-01T00:00:00.000Z')
      const updated = store.update(ann.id, { feedback: 'new' })
      expect(updated?.updatedAt).not.toBe(originalUpdatedAt)
      vi.restoreAllMocks()
    })

    it('returns null for non-existent ID', () => {
      expect(store.update('nope', { feedback: 'x' })).toBeNull()
    })
  })

  describe('status lifecycle', () => {
    it('pending -> acknowledged', () => {
      const ann = store.create(makeInput())
      expect(ann.status).toBe('pending')

      const acked = store.acknowledge(ann.id)
      expect(acked?.status).toBe('acknowledged')
      expect(acked?.acknowledgedAt).toBeTruthy()
    })

    it('pending -> resolved', () => {
      const ann = store.create(makeInput())
      const resolved = store.resolve(ann.id, 'Fixed the bug', 'claude')
      expect(resolved?.status).toBe('resolved')
      expect(resolved?.resolvedAt).toBeTruthy()
      expect(resolved?.resolvedBy).toBe('claude')
      expect(resolved?.resolutionSummary).toBe('Fixed the bug')
    })

    it('pending -> dismissed', () => {
      const ann = store.create(makeInput())
      const dismissed = store.dismiss(ann.id, 'Not a bug')
      expect(dismissed?.status).toBe('dismissed')
      expect(dismissed?.dismissReason).toBe('Not a bug')
    })

    it('acknowledged -> resolved', () => {
      const ann = store.create(makeInput())
      store.acknowledge(ann.id)
      const resolved = store.resolve(ann.id, 'All done')
      expect(resolved?.status).toBe('resolved')
    })
  })

  describe('remove()', () => {
    it('removes annotation from store', () => {
      const ann = store.create(makeInput())
      expect(store.annotations.value.length).toBe(1)
      const removed = store.remove(ann.id)
      expect(removed).toBe(true)
      expect(store.annotations.value.length).toBe(0)
    })

    it('returns false for non-existent ID', () => {
      expect(store.remove('nope')).toBe(false)
    })
  })

  describe('replyToQuestion()', () => {
    it('sets reply and timestamp', () => {
      const ann = store.create(makeInput())
      store.update(ann.id, { agentQuestion: 'What color?' })

      const replied = store.replyToQuestion(ann.id, 'Blue')
      expect(replied?.agentQuestionReply).toBe('Blue')
      expect(replied?.agentQuestionReplyAt).toBeTruthy()
    })
  })

  describe('clear()', () => {
    it('removes all annotations', () => {
      store.create(makeInput())
      store.create(makeInput())
      store.create(makeInput())
      expect(store.annotations.value.length).toBe(3)

      store.clear()
      expect(store.annotations.value.length).toBe(0)
    })
  })
})
