import { describe, it, expect } from 'vitest'
import {
  extractArticleNumber,
  matchKnownNorm,
  matchKnownJurisprudence,
} from './citation-sources'

describe('extractArticleNumber', () => {
  it('returns null when no article token', () => {
    expect(extractArticleNumber('CCyCN sin número')).toBeNull()
  })

  it('parses art., artículo, and abbreviations', () => {
    expect(extractArticleNumber('art. 42 CCyCN')).toBe(42)
    expect(extractArticleNumber('artículo 7 LCT')).toBe(7)
    expect(extractArticleNumber('Art 1')).toBe(1)
  })
})

describe('matchKnownNorm', () => {
  it('verifies known codes when article in range', () => {
    const v = matchKnownNorm('CCyCN art. 100')
    expect(v.kind).toBe('verified')
    if (v.kind === 'verified') {
      expect(v.label).toContain('art. 100')
      expect(v.url).toMatch(/^https?:\/\//)
    }
  })

  it('returns invalid when article exceeds max for that norm', () => {
    const v = matchKnownNorm('CCyCN art. 9999')
    expect(v.kind).toBe('invalid')
    if (v.kind === 'invalid') {
      expect(v.reason).toMatch(/2671/)
    }
  })

  it('returns unknown for arbitrary text', () => {
    expect(matchKnownNorm('Norma fantasma 123/99').kind).toBe('unknown')
  })
})

describe('matchKnownJurisprudence', () => {
  it('verifies a leading case by pattern', () => {
    const v = matchKnownJurisprudence('Ekmekdjian c/ Sofovich')
    expect(v.kind).toBe('verified')
    if (v.kind === 'verified') {
      expect(v.label).toContain('Ekmekdjian')
      expect(v.source).toBe('dataset')
    }
  })

  it('returns unknown when not in dataset', () => {
    expect(matchKnownJurisprudence('Caso inexistente XYZ').kind).toBe('unknown')
  })
})
