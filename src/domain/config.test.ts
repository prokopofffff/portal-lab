import { describe, expect, it } from 'vitest'
import { CONFIG } from './config'

describe('CONFIG', () => {
  it('веса риска в сумме дают 1', () => {
    const { instability, energy, urgency } = CONFIG.risk.weights
    expect(instability + energy + urgency).toBeCloseTo(1, 10)
  })

  it('пороги риска строго возрастают', () => {
    const { medium, high, critical } = CONFIG.risk.thresholds
    expect(medium).toBeLessThan(high)
    expect(high).toBeLessThan(critical)
  })

  it('диапазоны появления лежат внутри границ там, где граница задана', () => {
    for (const key of ['energy', 'stability'] as const) {
      const spawn = CONFIG.spawn[key]
      const bounds = CONFIG.bounds[key]
      expect(spawn.min).toBeLessThanOrEqual(spawn.max)
      expect(spawn.min).toBeGreaterThanOrEqual(bounds.min)
      expect(spawn.max).toBeLessThanOrEqual(bounds.max)
    }
  })
})
