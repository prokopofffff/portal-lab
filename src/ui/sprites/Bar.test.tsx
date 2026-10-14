import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Bar } from './Bar'

function lit(meter: HTMLElement) {
  return meter.querySelectorAll('[data-lit="true"]').length
}

function meter(name: string) {
  return screen.getByRole('meter', { name })
}

describe('Bar', () => {
  it('отдаёт значения через aria, а подпись — только доступное имя', () => {
    render(<Bar label="Энергия" value={72} />)
    const bar = meter('Энергия')
    expect(bar).toHaveAttribute('aria-valuenow', '72')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar.textContent).toBe('')
  })

  it('учитывает свой максимум', () => {
    render(<Bar label="Время" value={120} max={400} />)
    const bar = meter('Время')
    expect(bar).toHaveAttribute('aria-valuemax', '400')
    expect(bar).toHaveAttribute('aria-valuenow', '120')
    expect(lit(bar)).toBe(3)
  })

  it('зажимает значение выше максимума', () => {
    render(<Bar label="Энергия" value={140} />)
    const bar = meter('Энергия')
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    expect(lit(bar)).toBe(10)
  })

  it('зажимает значение ниже нуля', () => {
    render(<Bar label="Энергия" value={-5} />)
    const bar = meter('Энергия')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(lit(bar)).toBe(0)
  })

  it('по умолчанию рисует 10 сегментов', () => {
    render(<Bar label="Энергия" value={72} />)
    const bar = meter('Энергия')
    expect(bar.querySelectorAll('[data-lit]')).toHaveLength(10)
    expect(lit(bar)).toBe(8)
  })

  it.each([
    [0, 0],
    [2, 1],
    [10, 1],
    [11, 2],
    [60, 6],
    [61, 7],
    [98, 10],
    [100, 10],
  ])('значение %i зажигает %i сегментов (округление вверх)', (value, expected) => {
    render(<Bar label="Полоска" value={value} />)
    expect(lit(meter('Полоска'))).toBe(expected)
  })

  it('принимает своё число сегментов и высоту', () => {
    render(<Bar label="Изучение" value={40} segments={20} height={12} />)
    const bar = meter('Изучение')
    const segs = bar.querySelectorAll<HTMLElement>('[data-lit]')
    expect(segs).toHaveLength(20)
    expect(lit(bar)).toBe(8)
    expect(segs[0]?.style.height).toBe('12px')
  })

  it('красит зажжённые сегменты заданным цветом', () => {
    render(<Bar label="Энергия" value={50} color="var(--risk-high-c)" />)
    expect(meter('Энергия').style.getPropertyValue('--px-bar-fill')).toBe('var(--risk-high-c)')
  })
})
