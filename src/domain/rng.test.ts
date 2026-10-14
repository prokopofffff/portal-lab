import { describe, expect, it } from 'vitest'
import { createRng } from './rng'

function draw(seed: number, count: number): number[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, () => rng.next())
}

describe('createRng', () => {
  it('один сид даёт одну и ту же последовательность', () => {
    expect(draw(42, 100)).toEqual(draw(42, 100))
  })

  it('разные сиды дают разные последовательности', () => {
    expect(draw(1, 100)).not.toEqual(draw(2, 100))
  })

  it('фиксирует первые значения для сида 1 (защита от смены алгоритма)', () => {
    expect(draw(1, 3)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522])
  })

  it('next() возвращает числа из [0, 1)', () => {
    for (const value of draw(7, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('после state() можно продолжить ту же последовательность', () => {
    const rng = createRng(99)
    for (let i = 0; i < 17; i++) rng.next()
    const resumed = createRng(rng.state())
    for (let i = 0; i < 50; i++) expect(resumed.next()).toBe(rng.next())
  })

  describe('int', () => {
    it('остаётся в диапазоне и достигает обеих границ', () => {
      const rng = createRng(3)
      const seen = new Set<number>()
      for (let i = 0; i < 10_000; i++) {
        const value = rng.int(10, 95)
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(10)
        expect(value).toBeLessThanOrEqual(95)
        seen.add(value)
      }
      expect(seen.has(10)).toBe(true)
      expect(seen.has(95)).toBe(true)
    })

    it('при min === max возвращает это значение', () => {
      expect(createRng(5).int(5, 5)).toBe(5)
    })

    it('бросает RangeError, если min > max', () => {
      expect(() => createRng(1).int(6, 5)).toThrow(RangeError)
    })

    it('бросает RangeError на нецелых границах', () => {
      expect(() => createRng(1).int(1.5, 5)).toThrow(RangeError)
      expect(() => createRng(1).int(1, 5.5)).toThrow(RangeError)
      expect(() => createRng(1).int(Number.NaN, 5)).toThrow(RangeError)
    })
  })

  describe('pick', () => {
    it('возвращает элементы списка и достигает каждого', () => {
      const list = ['a', 'b', 'c'] as const
      const rng = createRng(11)
      const seen = new Set<string>()
      for (let i = 0; i < 300; i++) {
        const item = rng.pick(list)
        expect(list).toContain(item)
        seen.add(item)
      }
      expect(seen.size).toBe(3)
    })

    it('бросает RangeError на пустом списке', () => {
      expect(() => createRng(1).pick([])).toThrow(RangeError)
    })
  })
})
