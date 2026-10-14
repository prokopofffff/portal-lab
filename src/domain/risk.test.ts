import { describe, expect, it } from 'vitest'
import { assessRisk } from './risk'

describe('assessRisk: примеры из spec §3', () => {
  it('стаб. 90, энергия 30, время 300 — 4 + 9 + 0 = 13, низкий', () => {
    const risk = assessRisk({ stability: 90, energy: 30, timeLeft: 300 })

    expect(risk.score).toBe(13)
    expect(risk.level).toBe('low')
    expect(risk.parts.instability).toBeCloseTo(4)
    expect(risk.parts.energy).toBeCloseTo(9)
    expect(risk.parts.urgency).toBeCloseTo(0)
    expect(risk.hardRule).toBe(false)
  })

  it('стаб. 30, энергия 80, время 40 — 28 + 24 + 20 = 72, высокий', () => {
    // срочность: 100 × (1 − 40/120) = 66.67 → 0.3 × 66.67 = 20
    const risk = assessRisk({ stability: 30, energy: 80, timeLeft: 40 })

    expect(risk.score).toBe(72)
    expect(risk.level).toBe('high')
    expect(risk.parts.instability).toBeCloseTo(28)
    expect(risk.parts.energy).toBeCloseTo(24)
    expect(risk.parts.urgency).toBeCloseTo(20)
    expect(risk.hardRule).toBe(false)
  })
})

describe('assessRisk: границы уровней (spec §3)', () => {
  // Время 300 и больше даёт срочность 0, поэтому там, где она не нужна, берём время ≥ 120.
  // Жёсткое правило не срабатывает: стабильность > 15, время > 10.
  it.each([
    // 0.4·(100−50) + 0.3·30 = 20 + 9 = 29
    { stability: 50, energy: 30, timeLeft: 300, score: 29, level: 'low' },
    // 0.4·(100−40) + 0.3·20 = 24 + 6 = 30
    { stability: 40, energy: 20, timeLeft: 300, score: 30, level: 'medium' },
    // 0.4·(100−40) + 0.3·100 = 24 + 30 = 54
    { stability: 40, energy: 100, timeLeft: 300, score: 54, level: 'medium' },
    // 0.4·(100−30) + 0.3·90 = 28 + 27 = 55
    { stability: 30, energy: 90, timeLeft: 300, score: 55, level: 'high' },
    // 0.4·50 + 0.3·100 + 0.3·80 = 20 + 30 + 24 = 74 (время 24: 100·(1 − 24/120) = 80)
    { stability: 50, energy: 100, timeLeft: 24, score: 74, level: 'high' },
    // 0.4·50 + 0.3·100 + 0.3·83.33 = 20 + 30 + 25 = 75 (время 20: 100·(1 − 20/120) = 83.33)
    { stability: 50, energy: 100, timeLeft: 20, score: 75, level: 'critical' },
  ])('балл $score — уровень $level', ({ stability, energy, timeLeft, score, level }) => {
    const risk = assessRisk({ stability, energy, timeLeft })

    expect(risk.score).toBe(score)
    expect(risk.level).toBe(level)
    expect(risk.hardRule).toBe(false)
  })
})

describe('assessRisk: жёсткое правило (spec §3)', () => {
  it('стаб. 12, энергия 20, время 300 — балл 41, но уровень критический', () => {
    // 0.4·(100−12) + 0.3·20 + 0 = 35,2 + 6 = 41,2 → 41
    const risk = assessRisk({ stability: 12, energy: 20, timeLeft: 300 })

    expect(risk.score).toBe(41)
    expect(risk.level).toBe('critical')
    expect(risk.parts.instability).toBeCloseTo(35.2)
    expect(risk.parts.energy).toBeCloseTo(6)
    expect(risk.parts.urgency).toBeCloseTo(0)
    expect(risk.hardRule).toBe(true)
  })

  // Стабильность 99 (вклад 0,4) и энергия 0 — риск почти целиком от срочности
  it.each([
    // 0,4 + 0,3 · 100·(1 − 10/120) = 0,4 + 27,5 = 27,9 → балл 28 (низкий по баллу)
    { timeLeft: 10, hardRule: true, score: 28, level: 'critical' },
    // 0,4 + 0,3 · 100·(1 − 11/120) = 0,4 + 27,25 = 27,65 → балл 28
    { timeLeft: 11, hardRule: false, score: 28, level: 'low' },
  ])(
    'время $timeLeft — жёсткое правило: $hardRule, уровень $level',
    ({ timeLeft, hardRule, score, level }) => {
      const risk = assessRisk({ stability: 99, energy: 0, timeLeft })

      expect(risk.hardRule).toBe(hardRule)
      expect(risk.level).toBe(level)
      expect(risk.score).toBe(score)
    },
  )

  // Время 300 — срочность 0, риск дают нестабильность и энергия
  it.each([
    // 0,4 · (100 − 15) = 34 → балл 34 (средний по баллу)
    { stability: 15, hardRule: true, score: 34, level: 'critical' },
    // 0,4 · (100 − 16) = 33,6 → балл 34
    { stability: 16, hardRule: false, score: 34, level: 'medium' },
  ])(
    'стабильность $stability — жёсткое правило: $hardRule, уровень $level',
    ({ stability, hardRule, score, level }) => {
      const risk = assessRisk({ stability, energy: 0, timeLeft: 300 })

      expect(risk.hardRule).toBe(hardRule)
      expect(risk.level).toBe(level)
      expect(risk.score).toBe(score)
    },
  )
})

describe('assessRisk: окно срочности (spec §3)', () => {
  it('время 120 — срочность 0', () => {
    expect(assessRisk({ stability: 50, energy: 50, timeLeft: 120 }).parts.urgency).toBe(0)
  })

  it('время 119 — срочность уже больше нуля', () => {
    // 0,3 · 100 · (1 − 119/120) = 0,3 · 0,8333 = 0,25
    const { parts } = assessRisk({ stability: 50, energy: 50, timeLeft: 119 })

    expect(parts.urgency).toBeCloseTo(0.25)
  })

  it.each([120, 121, 300, 400])('время %i — срочность 0', (timeLeft) => {
    expect(assessRisk({ stability: 50, energy: 50, timeLeft }).parts.urgency).toBe(0)
  })
})
