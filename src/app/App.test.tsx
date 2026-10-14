import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('показывает заголовок лаборатории', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
  })

  it('галерея спрайтов содержит все виды портала', () => {
    const { container } = render(<App />)
    for (const look of ['empty', 'low', 'medium', 'high', 'critical', 'archived']) {
      expect(container.querySelector(`[data-look="${look}"]`)).toBeInTheDocument()
    }
  })

  it('галерея показывает наблюдателей, полоски и существ', () => {
    render(<App />)
    expect(screen.getAllByTestId('observer').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('meter').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('img', { name: /^Изучено \d+ из \d+$/ }).length).toBeGreaterThan(0)
  })
})
