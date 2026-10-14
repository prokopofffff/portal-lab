import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { labWith, logEntry, portal, storeWithLab, world } from '../test/labFixtures'
import { App } from './App'
import { LabStoreProvider } from './hooks'

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

const TOPI = 'Пепельные Топи'

function renderApp() {
  const store = storeWithLab(
    labWith({
      worlds: { [TOPI]: world(TOPI, 'ПТ-420', { studied: 3, visits: 2, lastVisit: 131 }) },
      portals: [portal('ПТ-420-1', TOPI), portal('ПТ-420-2', TOPI, { status: 'closed', arch: 1 })],
      log: [logEntry(120, 'Открыт портал ПТ-420-1 — первое посещение', { world: TOPI })],
    }),
  )
  return render(
    <LabStoreProvider store={store}>
      <App />
    </LabStoreProvider>,
  )
}

// Временная навигация «Зал · Атлас · Книга» (до дока lab-9dr.3)
describe('App: переходы между экранами', () => {
  it('начинает с зала; ссылки «Зал», «Атлас», «Книга» переключают экраны', async () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Зал' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(screen.getByRole('link', { name: 'Атлас' }))
    expect(screen.getByRole('heading', { name: 'АТЛАС МИРОВ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Атлас' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(screen.getByRole('link', { name: 'Книга' }))
    expect(screen.getByRole('heading', { name: 'КНИГА ЖУРНАЛА' })).toBeInTheDocument()
    expect(screen.getByText('разворот 1 · записей: 1')).toBeInTheDocument()
    expect(screen.getByText('Открыт портал ПТ-420-1 — первое посещение')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Зал' }))
    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
  })

  it('атлас → страница мира → портал → обратно в мир → в атлас', async () => {
    renderApp()

    await userEvent.click(screen.getByRole('link', { name: 'Атлас' }))
    await userEvent.click(screen.getByRole('link', { name: /Страница мира/ }))
    expect(screen.getByRole('heading', { level: 1, name: TOPI })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: /ПТ-420-1/ }))
    expect(screen.getByRole('heading', { name: 'ПТ-420-1' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: TOPI }))
    expect(screen.getByRole('heading', { level: 1, name: TOPI })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: '← Атлас миров' }))
    expect(screen.getByRole('heading', { name: 'АТЛАС МИРОВ' })).toBeInTheDocument()
  })
})
