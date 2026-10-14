import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { risk, type PortalLook, type RiskLevel } from '../theme/tokens'
import { Portal } from './Portal'

const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical']

const names: Record<PortalLook, string> = {
  empty: 'Пустая арка',
  archived: 'Портал погас',
  low: 'Портал, риск Низкий',
  medium: 'Портал, риск Средний',
  high: 'Портал, риск Высокий',
  critical: 'Портал, риск Критический',
}

describe('Portal', () => {
  it.each(Object.entries(names))('вид «%s» помечен и назван «%s»', (look, name) => {
    render(<Portal look={look as PortalLook} />)
    expect(screen.getByRole('img', { name })).toHaveAttribute('data-look', look)
  })

  it.each(riskLevels)('при риске «%s» показывает руну и слово уровня', (level) => {
    render(<Portal look={level} />)
    const portal = screen.getByRole('img', { name: names[level] })
    expect(within(portal).getByRole('img', { name: risk[level].label })).toBeInTheDocument()
    expect(within(portal).getByText(risk[level].label)).toBeVisible()
  })

  it.each(['empty', 'archived'] as const)('вид «%s» без руны и без наблюдателей', (look) => {
    render(<Portal look={look} observers={3} />)
    const portal = screen.getByRole('img', { name: names[look] })
    expect(within(portal).queryAllByRole('img')).toHaveLength(0)
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

  it('рисует пиксель-арт чёткими краями', () => {
    const { container } = render(<Portal look="critical" />)
    expect(container.querySelector('svg')).toHaveAttribute('shape-rendering', 'crispEdges')
  })
})
