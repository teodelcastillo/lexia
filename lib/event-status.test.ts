/**
 * Unit tests for event status utilities.
 * Run with: npx vitest run lib/event-status.test.ts
 */
import { describe, it, expect } from 'vitest'
import {
  getTemporalState,
  getPreparationState,
  getLegalRisk,
  inferEventKind,
  getPreparationPercent,
  getEventStatus,
} from './event-status'

describe('getTemporalState', () => {
  const baseDate = new Date('2025-02-19T12:00:00Z')

  it('returns pasado for past dates', () => {
    expect(getTemporalState('2025-02-18', baseDate)).toBe('pasado')
    expect(getTemporalState(new Date('2025-02-17'), baseDate)).toBe('pasado')
  })

  it('returns hoy for same day', () => {
    expect(getTemporalState('2025-02-19', baseDate)).toBe('hoy')
    expect(getTemporalState(new Date('2025-02-19T23:59:59Z'), baseDate)).toBe('hoy')
  })

  it('returns proximo for future dates', () => {
    expect(getTemporalState('2025-02-20', baseDate)).toBe('proximo')
    expect(getTemporalState(new Date('2025-03-01'), baseDate)).toBe('proximo')
  })
})

describe('getPreparationState', () => {
  it('returns no_aplica for empty tasks', () => {
    expect(getPreparationState([])).toBe('no_aplica')
    expect(getPreparationState([])).toBe('no_aplica')
  })

  it('returns listo when all tasks completed', () => {
    expect(
      getPreparationState([{ status: 'completed' }, { status: 'completed' }])
    ).toBe('listo')
  })

  it('returns en_curso when any task in_progress or under_review', () => {
    expect(getPreparationState([{ status: 'in_progress' }, { status: 'pending' }])).toBe('en_curso')
    expect(getPreparationState([{ status: 'under_review' }])).toBe('en_curso')
  })

  it('returns sin_iniciar when no completed and no in_progress', () => {
    expect(getPreparationState([{ status: 'pending' }])).toBe('sin_iniciar')
    expect(getPreparationState([{ status: 'pending' }, { status: 'pending' }])).toBe('sin_iniciar')
  })

  it('excludes cancelled tasks', () => {
    expect(getPreparationState([{ status: 'cancelled' }])).toBe('no_aplica')
    expect(
      getPreparationState([{ status: 'completed' }, { status: 'cancelled' }])
    ).toBe('listo')
  })
})

describe('getLegalRisk', () => {
  it('returns ninguno when preparation is no_aplica', () => {
    expect(getLegalRisk('deliverable', 'pasado', 'no_aplica')).toBe('ninguno')
  })

  it('returns alto for deliverable + pasado + not listo', () => {
    expect(getLegalRisk('deliverable', 'pasado', 'sin_iniciar')).toBe('alto')
    expect(getLegalRisk('deliverable', 'pasado', 'en_curso')).toBe('alto')
  })

  it('returns medio for deliverable + hoy + not listo', () => {
    expect(getLegalRisk('deliverable', 'hoy', 'sin_iniciar')).toBe('medio')
  })

  it('returns bajo for meeting/hearing/other regardless of preparation', () => {
    expect(getLegalRisk('meeting', 'pasado', 'sin_iniciar')).toBe('bajo')
    expect(getLegalRisk('hearing', 'pasado', 'no_aplica')).toBe('bajo')
    expect(getLegalRisk('other', 'pasado', 'sin_iniciar')).toBe('bajo')
  })

  it('returns bajo when preparation is listo', () => {
    expect(getLegalRisk('deliverable', 'pasado', 'listo')).toBe('bajo')
  })
})

describe('inferEventKind', () => {
  it('infers deliverable from text', () => {
    expect(inferEventKind('Vencimiento contestación')).toBe('deliverable')
    expect(inferEventKind('Presentar escrito', null, null)).toBe('deliverable')
  })

  it('infers hearing from text', () => {
    expect(inferEventKind('Audiencia de juicio')).toBe('hearing')
    expect(inferEventKind('Tribunal oral')).toBe('hearing')
  })

  it('infers meeting from text', () => {
    expect(inferEventKind('Reunión con cliente')).toBe('meeting')
  })

  it('uses deadline_type when provided', () => {
    expect(inferEventKind('Foo', null, 'court_date')).toBe('hearing')
    expect(inferEventKind('Bar', null, 'filing_deadline')).toBe('deliverable')
    expect(inferEventKind('Baz', null, 'meeting')).toBe('meeting')
  })
})

describe('getPreparationPercent', () => {
  it('returns 100 when no tasks', () => {
    expect(getPreparationPercent([])).toEqual({ completed: 0, total: 0, percent: 100 })
  })

  it('calculates percent correctly', () => {
    expect(
      getPreparationPercent([{ status: 'completed' }, { status: 'completed' }])
    ).toEqual({ completed: 2, total: 2, percent: 100 })
    expect(
      getPreparationPercent([{ status: 'completed' }, { status: 'pending' }])
    ).toEqual({ completed: 1, total: 2, percent: 50 })
  })
})

describe('getEventStatus', () => {
  const baseDate = new Date('2025-02-19T12:00:00Z')

  it('returns full status for deliverable past and not ready', () => {
    const r = getEventStatus(
      '2025-02-18',
      [{ status: 'pending' }],
      undefined,
      'Vencimiento',
      null,
      undefined,
      undefined,
      baseDate
    )
    expect(r.temporal).toBe('pasado')
    expect(r.preparation).toBe('sin_iniciar')
    expect(r.legalRisk).toBe('alto')
    expect(r.eventKind).toBe('deliverable')
  })

  it('returns listo + bajo risk for past event with all tasks done', () => {
    const r = getEventStatus(
      '2025-02-18',
      [{ status: 'completed' }],
      undefined,
      'Vencimiento',
      null,
      undefined,
      undefined,
      baseDate
    )
    expect(r.temporal).toBe('pasado')
    expect(r.preparation).toBe('listo')
    expect(r.legalRisk).toBe('bajo')
  })

  it('respects preparation_override', () => {
    const r = getEventStatus(
      '2025-02-18',
      [{ status: 'pending' }],
      undefined,
      null,
      null,
      undefined,
      'listo',
      baseDate
    )
    expect(r.preparation).toBe('listo')
    expect(r.legalRisk).toBe('bajo')
  })

  it('respects eventKind override', () => {
    const r = getEventStatus(
      '2025-02-18',
      [{ status: 'pending' }],
      'meeting',
      'Vencimiento',
      null,
      undefined,
      undefined,
      baseDate
    )
    expect(r.eventKind).toBe('meeting')
    expect(r.legalRisk).toBe('bajo')
  })
})
