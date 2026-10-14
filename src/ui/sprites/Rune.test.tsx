import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { risk, type RiskLevel } from '../theme/tokens'
import { Rune } from './Rune'

const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical']

describe('Rune', () => {
  it.each(levels)('подписана словом уровня «%s»', (level) => {
    render(<Rune level={level} />)
    expect(screen.getByRole('img', { name: risk[level].label })).toBeInTheDocument()
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

  it('рисуется чёткими пикселями заданного размера', () => {
    const { container } = render(<Rune level="high" size={28} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('shape-rendering', 'crispEdges')
    expect(svg).toHaveAttribute('width', '28')
    expect(svg).toHaveAttribute('height', '28')
  })
})
