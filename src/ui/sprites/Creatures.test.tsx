import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Creatures } from './Creatures'

function count(root: HTMLElement, studied: boolean) {
  return root.querySelectorAll(`[data-studied="${studied}"]`).length
}

describe('Creatures', () => {
  it('показывает изученных проявленными, остальных — тёмными «?»', () => {
    render(<Creatures total={9} studied={3} />)
    const row = screen.getByRole('img', { name: 'Изучено 3 из 9' })
    expect(count(row, true)).toBe(3)
    expect(count(row, false)).toBe(6)
    const unknown = row.querySelectorAll('[data-studied="false"]')
    for (const silhouette of unknown) expect(silhouette).toHaveTextContent('?')
    for (const silhouette of row.querySelectorAll('[data-studied="true"]')) {
      expect(silhouette).not.toHaveTextContent('?')
    }
  })

  it('изученные идут первыми', () => {
    render(<Creatures total={4} studied={2} />)
    const flags = [...screen.getByRole('img').querySelectorAll('[data-studied]')].map((el) =>
      el.getAttribute('data-studied'),
    )
    expect(flags).toEqual(['true', 'true', 'false', 'false'])
  })

  it('зажимает изученных сверху числом всех существ', () => {
    render(<Creatures total={4} studied={7} />)
    const row = screen.getByRole('img', { name: 'Изучено 4 из 4' })
    expect(count(row, true)).toBe(4)
    expect(count(row, false)).toBe(0)
  })

  it('зажимает отрицательное число изученных до нуля', () => {
    render(<Creatures total={3} studied={-2} />)
    const row = screen.getByRole('img', { name: 'Изучено 0 из 3' })
    expect(count(row, true)).toBe(0)
    expect(count(row, false)).toBe(3)
  })

  it('без существ пишет «Существ нет»', () => {
    render(<Creatures total={0} studied={0} />)
    const row = screen.getByRole('img', { name: 'Существ нет' })
    expect(row).toHaveTextContent('Существ нет')
    expect(row.querySelectorAll('[data-studied]')).toHaveLength(0)
  })
})
