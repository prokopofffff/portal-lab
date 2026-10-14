import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Creatures } from './Creatures'

function cells(root: HTMLElement, studied: 'true' | 'false' | 'partial') {
  return [...root.querySelectorAll<HTMLElement>(`[data-studied="${studied}"]`)]
}

function glyph(cell: HTMLElement) {
  return cell.querySelector('path')?.getAttribute('d')
}

describe('Creatures', () => {
  it('показывает изученных проявленными, остальных — знаком «?»', () => {
    render(<Creatures total={9} studied={3} />)
    const row = screen.getByRole('img', { name: 'Изучено 3 из 9' })
    const known = cells(row, 'true')
    const unknown = cells(row, 'false')
    expect(known).toHaveLength(3)
    expect(unknown).toHaveLength(6)
    const unknownGlyphs = new Set(unknown.map(glyph))
    expect(unknownGlyphs.size).toBe(1)
    for (const cell of known) expect(unknownGlyphs.has(glyph(cell))).toBe(false)
  })

  it('чередует четыре силуэта существ', () => {
    render(<Creatures total={5} studied={5} />)
    const glyphs = cells(screen.getByRole('img'), 'true').map(glyph)
    expect(new Set(glyphs.slice(0, 4)).size).toBe(4)
    expect(glyphs[4]).toBe(glyphs[0])
  })

  it('изученные идут первыми', () => {
    render(<Creatures total={4} studied={2} />)
    const flags = [...screen.getByRole('img').querySelectorAll('[data-studied]')].map((el) =>
      el.getAttribute('data-studied'),
    )
    expect(flags).toEqual(['true', 'true', 'false', 'false'])
  })

  it('когда изучены все, ряд в золотой рамке', () => {
    render(<Creatures total={9} studied={9} />)
    const row = screen.getByRole('img', { name: 'Изучено 9 из 9' })
    expect(row).toHaveAttribute('data-full', 'true')
    expect(cells(row, 'true')).toHaveLength(9)
  })

  it('пока изучены не все, рамка обычная', () => {
    render(<Creatures total={9} studied={8} />)
    expect(screen.getByRole('img')).toHaveAttribute('data-full', 'false')
  })

  it('изучаемое существо проявляется частично и подписано процентом', () => {
    render(<Creatures total={9} studied={3} progress={40} />)
    const row = screen.getByRole('img', { name: 'Изучено 3 из 9, следующее изучено на 40 %' })
    const partial = cells(row, 'partial')
    expect(partial).toHaveLength(1)
    expect(partial[0]).toHaveTextContent('40%')
    const flags = [...row.querySelectorAll('[data-studied]')].map((el) =>
      el.getAttribute('data-studied'),
    )
    expect(flags.indexOf('partial')).toBe(3)
    expect(cells(row, 'false')).toHaveLength(5)
  })

  it('без прогресса и при полном изучении частичной клетки нет', () => {
    render(
      <>
        <Creatures total={3} studied={1} progress={0} />
        <Creatures total={3} studied={3} progress={50} />
      </>,
    )
    expect(screen.getByRole('img', { name: 'Изучено 1 из 3' })).toBeInTheDocument()
    const full = screen.getByRole('img', { name: 'Изучено 3 из 3' })
    expect(cells(full, 'partial')).toHaveLength(0)
  })

  it('зажимает прогресс до 99', () => {
    render(<Creatures total={3} studied={0} progress={130} />)
    expect(
      screen.getByRole('img', { name: 'Изучено 0 из 3, следующее изучено на 99 %' }),
    ).toHaveTextContent('99%')
  })

  it('зажимает изученных сверху числом всех существ', () => {
    render(<Creatures total={4} studied={7} />)
    const row = screen.getByRole('img', { name: 'Изучено 4 из 4' })
    expect(cells(row, 'true')).toHaveLength(4)
    expect(cells(row, 'false')).toHaveLength(0)
  })

  it('зажимает отрицательное число изученных до нуля', () => {
    render(<Creatures total={3} studied={-2} />)
    const row = screen.getByRole('img', { name: 'Изучено 0 из 3' })
    expect(cells(row, 'true')).toHaveLength(0)
    expect(cells(row, 'false')).toHaveLength(3)
  })

  it('размер клетки задаётся, силуэт кратен 8 пикселям', () => {
    render(<Creatures total={1} studied={1} size={40} />)
    const cell = cells(screen.getByRole('img'), 'true')[0]!
    expect(cell.style.width).toBe('40px')
    expect(cell.querySelector('svg')).toHaveAttribute('width', '32')
  })

  it('без существ пишет «Существ нет»', () => {
    render(<Creatures total={0} studied={0} />)
    const row = screen.getByRole('img', { name: 'Существ нет' })
    expect(row).toHaveTextContent('Существ нет')
    expect(row.querySelectorAll('[data-studied]')).toHaveLength(0)
  })
})
