import { describe, expect, it } from 'vitest'
import { contrastRatio } from './contrast'
import { textPairs } from './tokens'

describe('contrastRatio', () => {
  it('чёрный на белом = 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  })

  it('одинаковые цвета = 1', () => {
    expect(contrastRatio('#5be0c0', '#5be0c0')).toBeCloseTo(1, 5)
  })

  it('не зависит от порядка аргументов', () => {
    expect(contrastRatio('#efe6d0', '#14111c')).toBeCloseTo(contrastRatio('#14111c', '#efe6d0'), 10)
  })
})

describe('пары текст/фон из токенов', () => {
  it.each(textPairs)('$name: контраст ≥ $min', ({ fg, bg, min }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min)
  })
})
