import { describe, it, expect } from 'vitest'
import { aggregateGroundingStatus } from './grounding'
import type { GroundedVerdict } from './grounding'

function v(partial: Partial<GroundedVerdict> & Pick<GroundedVerdict, 'index' | 'status'>): GroundedVerdict {
  return {
    confidence: 0.5,
    explanation: 'x',
    sourceType: 'unresolved',
    ...partial,
  }
}

describe('aggregateGroundingStatus', () => {
  it('returns grounded for empty list', () => {
    expect(aggregateGroundingStatus([])).toBe('grounded')
  })

  it('ungrounded if any invalid', () => {
    expect(
      aggregateGroundingStatus([
        v({ index: 0, status: 'verified' }),
        v({ index: 1, status: 'invalid' }),
        v({ index: 2, status: 'warning' }),
      ])
    ).toBe('ungrounded')
  })

  it('partial if warning and no invalid', () => {
    expect(
      aggregateGroundingStatus([
        v({ index: 0, status: 'verified' }),
        v({ index: 1, status: 'warning' }),
      ])
    ).toBe('partial')
  })

  it('grounded if all verified', () => {
    expect(aggregateGroundingStatus([v({ index: 0, status: 'verified' })])).toBe('grounded')
  })
})
