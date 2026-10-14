import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('показывает заголовок лаборатории', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
  })

  it('подписывает уровни риска словами', () => {
    render(<App />)
    expect(screen.getByRole('list', { name: 'Уровни риска' })).toHaveTextContent('Критический')
  })
})
