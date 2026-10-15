import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PortalLook } from '../theme/tokens'
import { Portal } from './Portal'

const names: Record<PortalLook, string> = {
  empty: 'Пустая арка',
  archived: 'Портал погас',
  low: 'Портал, риск низкий',
  medium: 'Портал, риск средний',
  high: 'Портал, риск высокий',
  critical: 'Портал, риск критический',
}

const sparks: [PortalLook, number][] = [
  ['low', 0],
  ['medium', 2],
  ['high', 4],
  ['critical', 6],
  ['archived', 0],
  ['empty', 0],
]

describe('Portal', () => {
  it.each(Object.entries(names))('вид «%s» помечен и назван «%s»', (look, name) => {
    render(<Portal look={look as PortalLook} />)
    expect(screen.getByRole('img', { name })).toHaveAttribute('data-look', look)
  })

  it.each(Object.keys(names))('вид «%s» — только арка, без плашки с руной и словом', (look) => {
    render(<Portal look={look as PortalLook} />)
    const portal = screen.getByRole('img', { name: names[look as PortalLook] })
    expect(within(portal).queryAllByRole('img')).toHaveLength(0)
    expect(portal.textContent).toBe('')
  })

  it.each(sparks)('вид «%s» выпускает %i искр', (look, n) => {
    const { container } = render(<Portal look={look} />)
    expect(container.querySelectorAll('.px-portal__spark')).toHaveLength(n)
  })

  it('пустая арка тлеет рунами вместо портала', () => {
    const { container } = render(<Portal look="empty" />)
    expect(container.querySelectorAll('.px-portal__rune')).toHaveLength(3)
    expect(container.querySelector('.px-portal__core')).not.toBeInTheDocument()
  })

  it.each(['empty', 'archived'] as const)('вид «%s» без наблюдателей', (look) => {
    render(<Portal look={look} observers={3} />)
    const portal = screen.getByRole('img', { name: names[look] })
    expect(within(portal).queryAllByTestId('observer')).toHaveLength(0)
  })

  it.each([0, 1, 2, 3])('рисует %i наблюдателей у арки', (n) => {
    render(<Portal look="medium" observers={n} />)
    const name = n > 0 ? `${names.medium}, наблюдателей: ${n}` : names.medium
    const portal = screen.getByRole('img', { name })
    expect(within(portal).queryAllByTestId('observer')).toHaveLength(n)
  })

  it('больше трёх наблюдателей не помещается', () => {
    render(<Portal look="high" observers={5} />)
    const portal = screen.getByRole('img', { name: `${names.high}, наблюдателей: 3` })
    expect(within(portal).getAllByTestId('observer')).toHaveLength(3)
  })

  it('отрицательное число наблюдателей — ноль', () => {
    render(<Portal look="low" observers={-1} />)
    const portal = screen.getByRole('img', { name: names.low })
    expect(within(portal).queryAllByTestId('observer')).toHaveLength(0)
  })

  it('по умолчанию 120 px в ширину, высота по пропорции 24×28', () => {
    render(<Portal look="low" />)
    const portal = screen.getByRole('img')
    expect(portal.style.width).toBe('120px')
    expect(portal.style.height).toBe('140px')
    expect(portal.querySelector('svg')).toHaveAttribute('viewBox', '0 0 24 28')
  })

  it('наблюдатели масштабируются вместе с аркой', () => {
    render(<Portal look="critical" observers={1} width={130} />)
    const portal = screen.getByRole('img')
    expect(portal.style.height).toBe('152px')
    const observer = within(portal).getByTestId('observer')
    expect(observer).toHaveAttribute('width', '56')
    expect(observer).toHaveAttribute('height', '80')
  })

  it('рисует пиксель-арт чёткими краями', () => {
    const { container } = render(<Portal look="critical" />)
    expect(container.querySelector('svg')).toHaveAttribute('shape-rendering', 'crispEdges')
  })
})
