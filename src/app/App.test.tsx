import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('показывает заголовок лаборатории', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
  })

  it('«Язык риска»: все виды портала, каждый с плашкой', () => {
    const { container } = render(<App />)
    for (const look of ['empty', 'low', 'medium', 'high', 'critical', 'archived']) {
      expect(container.querySelector(`.px-portal[data-look="${look}"]`)).toBeInTheDocument()
      expect(container.querySelector(`.px-risk-tag[data-look="${look}"]`)).toBeInTheDocument()
    }
    expect(screen.getByText('КРИТИЧЕСКИЙ')).toBeInTheDocument()
    expect(screen.getByText('ЗАКРЫТ / СХЛОПНУЛСЯ')).toBeInTheDocument()
  })

  it('галерея показывает наблюдателей 1, 2 и 3', () => {
    render(<App />)
    for (const n of [1, 2, 3]) {
      const named = screen.getAllByRole('img', { name: new RegExp(`наблюдателей: ${n}$`) })
      expect(named.length).toBeGreaterThan(0)
    }
  })

  it('полоски подписаны снаружи и отдают значение через aria', () => {
    render(<App />)
    expect(screen.getByRole('meter', { name: 'Энергия' })).toHaveAttribute('aria-valuenow', '82')
    expect(screen.getByRole('meter', { name: 'Стабильность' })).toHaveAttribute(
      'aria-valuenow',
      '14',
    )
    expect(screen.getByRole('meter', { name: 'Изучение' })).toHaveAttribute('aria-valuenow', '40')
    const visibleLabel = screen.getByText('Энергия')
    expect(visibleLabel).toBeVisible()
    expect(visibleLabel).toHaveAttribute('aria-hidden', 'true')
  })

  it('существа: частичное изучение, полный набор и пустой мир', () => {
    render(<App />)
    expect(
      screen.getByRole('img', { name: 'Изучено 3 из 9, следующее изучено на 40 %' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Изучено 9 из 9' })).toHaveAttribute('data-full', 'true')
    expect(screen.getByRole('img', { name: 'Существ нет' })).toBeInTheDocument()
  })
})
