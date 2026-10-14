import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Bar } from './Bar'

function filledSegments(meter: HTMLElement) {
  return meter.querySelectorAll('[data-filled="true"]').length
}

describe('Bar', () => {
  it('отдаёт значения через aria и показывает подпись с числом', () => {
    render(<Bar label="Энергия" value={72} />)
    const meter = screen.getByRole('meter', { name: 'Энергия' })
    expect(meter).toHaveAttribute('aria-valuenow', '72')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '100')
    expect(meter).toHaveTextContent('Энергия')
    expect(meter).toHaveTextContent('72')
  })

  it('округляет число в тексте', () => {
    render(<Bar label="Стабильность" value={41.6} />)
    expect(screen.getByRole('meter', { name: 'Стабильность' })).toHaveTextContent('42')
  })

  it('учитывает свой максимум', () => {
    render(<Bar label="Время" value={120} max={400} />)
    const meter = screen.getByRole('meter', { name: 'Время' })
    expect(meter).toHaveAttribute('aria-valuemax', '400')
    expect(meter).toHaveAttribute('aria-valuenow', '120')
    expect(filledSegments(meter)).toBe(3)
  })

  it('зажимает значение выше максимума', () => {
    render(<Bar label="Энергия" value={140} />)
    const meter = screen.getByRole('meter', { name: 'Энергия' })
    expect(meter).toHaveAttribute('aria-valuenow', '100')
    expect(meter).toHaveTextContent('100')
    expect(filledSegments(meter)).toBe(10)
  })

  it('зажимает значение ниже нуля', () => {
    render(<Bar label="Энергия" value={-5} />)
    const meter = screen.getByRole('meter', { name: 'Энергия' })
    expect(meter).toHaveAttribute('aria-valuenow', '0')
    expect(meter).toHaveTextContent('0')
    expect(filledSegments(meter)).toBe(0)
  })

  it('рисует заливку дискретными сегментами', () => {
    render(<Bar label="Энергия" value={72} />)
    const meter = screen.getByRole('meter', { name: 'Энергия' })
    expect(meter.querySelectorAll('[data-filled]')).toHaveLength(10)
    expect(filledSegments(meter)).toBe(7)
  })

  it('не прячет почти пустую и не заполняет почти полную полоску', () => {
    render(
      <>
        <Bar label="Почти пусто" value={2} />
        <Bar label="Почти полно" value={98} />
      </>,
    )
    expect(filledSegments(screen.getByRole('meter', { name: 'Почти пусто' }))).toBe(1)
    expect(filledSegments(screen.getByRole('meter', { name: 'Почти полно' }))).toBe(9)
  })

  it('помечает тон для раскраски', () => {
    render(<Bar label="Риск" value={80} tone="critical" />)
    expect(screen.getByRole('meter', { name: 'Риск' })).toHaveAttribute('data-tone', 'critical')
  })
})
