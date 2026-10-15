import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { risk, sprite, type RiskLevel } from '../theme/tokens'
import { Rune } from './Rune'

const levels: (RiskLevel | 'archived')[] = ['low', 'medium', 'high', 'critical', 'archived']

describe('Rune', () => {
  it.each([
    ['low', 'Низкий риск'],
    ['medium', 'Средний риск'],
    ['high', 'Высокий риск'],
    ['critical', 'Критический риск'],
  ] as const)('руна уровня «%s» называется «%s»', (level, name) => {
    render(<Rune level={level} />)
    expect(screen.getByRole('img', { name })).toBeInTheDocument()
  })

  it('руна архива называется «Портал погас» и рисуется цветом погасшей руны', () => {
    const { container } = render(<Rune level="archived" />)
    expect(screen.getByRole('img', { name: 'Портал погас' })).toBeInTheDocument()
    expect(container.querySelector('path')).toHaveAttribute('fill', sprite.deadRune)
  })

  it('руна риска рисуется цветом своего уровня', () => {
    const { container } = render(<Rune level="critical" />)
    expect(container.querySelector('path')).toHaveAttribute('fill', risk.critical.c)
  })

  it('у каждого уровня своя форма глифа, а не только цвет', () => {
    const shapes = levels.map((level) => {
      const { container, unmount } = render(<Rune level={level} />)
      const d = [...container.querySelectorAll('path')].map((p) => p.getAttribute('d')).join('|')
      unmount()
      return d
    })
    expect(shapes.every((d) => d.length > 0)).toBe(true)
    expect(new Set(shapes).size).toBe(levels.length)
  })

  it('рисуется на сетке 7×7 чёткими пикселями, по умолчанию 16 px', () => {
    const { container } = render(<Rune level="high" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('viewBox', '0 0 7 7')
    expect(svg).toHaveAttribute('shape-rendering', 'crispEdges')
    expect(svg).toHaveAttribute('width', '16')
    expect(svg).toHaveAttribute('height', '16')
  })

  it('принимает свой размер', () => {
    const { container } = render(<Rune level="low" size={28} />)
    expect(container.querySelector('svg')).toHaveAttribute('width', '28')
  })
})
