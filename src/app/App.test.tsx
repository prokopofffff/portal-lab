import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { labWith, logEntry, portal, storeWithLab, world } from '../test/labFixtures'
import { App } from './App'
import { LabStoreProvider } from './hooks'
import type { Route } from './navigation'

const TOPI = 'Пепельные Топи'

function renderApp(initialRoute?: Route) {
  const store = storeWithLab(
    labWith({
      worlds: { [TOPI]: world(TOPI, 'ПТ-420', { studied: 3, visits: 2, lastVisit: 131 }) },
      portals: [portal('ПТ-420-1', TOPI), portal('ПТ-420-2', TOPI, { status: 'closed', arch: 1 })],
      log: [logEntry(120, 'Открыт портал ПТ-420-1 — первое посещение', { world: TOPI })],
    }),
  )
  return {
    store,
    ...render(
      <LabStoreProvider store={store}>
        <App initialRoute={initialRoute} />
      </LabStoreProvider>,
    ),
  }
}

describe('App', () => {
  it('показывает заголовок лаборатории', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
  })

  it('зал: открытый портал в своей арке, остальные 11 арок пусты', () => {
    renderApp()
    expect(
      screen.getByRole('button', { name: 'Открыть карточку портала ПТ-420-1' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Арка \d+ пуста/ })).toHaveLength(11)
  })
})

// Переходы через док «Зал лаборатории · Атлас миров · Книга журнала»
describe('App: переходы между экранами', () => {
  it('начинает с зала; вкладки дока переключают экраны', async () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Зал лаборатории' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await userEvent.click(screen.getByRole('link', { name: 'Атлас миров' }))
    expect(screen.getByRole('heading', { name: 'АТЛАС МИРОВ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Атлас миров' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await userEvent.click(screen.getByRole('link', { name: 'Книга журнала' }))
    expect(screen.getByRole('heading', { name: 'КНИГА ЖУРНАЛА' })).toBeInTheDocument()
    expect(screen.getByText('разворот 1 · записей: 1')).toBeInTheDocument()
    expect(screen.getByText('Открыт портал ПТ-420-1 — первое посещение')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Зал лаборатории' }))
    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
  })

  it('атлас → страница мира → портал → обратно в мир → в атлас', async () => {
    renderApp()

    await userEvent.click(screen.getByRole('link', { name: 'Атлас миров' }))
    await userEvent.click(screen.getByRole('link', { name: /Страница мира/ }))
    expect(screen.getByRole('heading', { level: 1, name: TOPI })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: /ПТ-420-1/ }))
    expect(screen.getByRole('heading', { name: 'ПТ-420-1' })).toBeInTheDocument()

    // Мир в карточке — кнопка-ссылка; карточка закрывается, открывается страница мира
    await userEvent.click(screen.getByRole('button', { name: TOPI }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: TOPI })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: '← Атлас миров' }))
    expect(screen.getByRole('heading', { name: 'АТЛАС МИРОВ' })).toBeInTheDocument()
  })
})

describe('App: карточка портала поверх экрана', () => {
  const ring = (name: string) =>
    screen.getByText(name, { selector: 'span' }).closest('main > div > div') as HTMLElement

  it('из зала: зал остаётся под карточкой, у её арки рамка фокуса', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Открыть карточку портала ПТ-420-1' }))

    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ПТ-420-1' })).toBeInTheDocument()
    expect(ring('ПТ-420-1').style.outline).toBe('3px dashed var(--c-torch-light)')
  })

  it('маршрут без back: под карточкой зал с рамкой на её портале', () => {
    renderApp({ screen: 'portal', portal: 'ПТ-420-1' })

    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
    expect(ring('ПТ-420-1').style.outline).toBe('3px dashed var(--c-torch-light)')
  })

  it('из мира: под карточкой страница мира, а не зал', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('link', { name: 'Атлас миров' }))
    await userEvent.click(screen.getByRole('link', { name: /Страница мира/ }))
    await userEvent.click(screen.getByRole('link', { name: /ПТ-420-1/ }))

    expect(screen.getByRole('heading', { level: 1, name: TOPI })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Лаборатория порталов' })).toBeNull()
  })
})

describe('App: диалог карточки', () => {
  const arch = () => screen.getByRole('button', { name: 'Открыть карточку портала ПТ-420-1' })

  it('пока карточка открыта, HUD, экран и док инертны; после закрытия — нет', async () => {
    renderApp()
    await userEvent.click(arch())
    const dialog = screen.getByRole('dialog', { name: 'ПТ-420-1' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('banner').closest('[inert]')).not.toBeNull()
    expect(arch().closest('[inert]')).not.toBeNull()
    expect(screen.getByRole('navigation', { name: 'Разделы' }).closest('[inert]')).not.toBeNull()
    expect(dialog.closest('[inert]')).toBeNull()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('[inert]')).toBeNull()
  })

  it('фокус уходит в диалог и возвращается на открывшую арку', async () => {
    renderApp()
    await userEvent.click(arch())
    expect(screen.getByRole('dialog')).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(arch()).toHaveFocus()
  })

  it('открывшего нет: фокус на основную область экрана', async () => {
    renderApp({ screen: 'portal', portal: 'ПТ-420-1' })
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть карточку' }))
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('крестик и клик по затемнению возвращают на экран под карточкой', async () => {
    renderApp()
    await userEvent.click(arch())
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть карточку' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    await userEvent.click(arch())
    await userEvent.click(screen.getByTestId('card-overlay'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
  })
})

describe('App: баннер отказа', () => {
  it('отказ из HUD («Нанять» во время найма) показывает баннер «ОТКАЗ»', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: /^Нанять/ }))
    expect(screen.queryByRole('alert')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /^Нанять/ }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('ОТКАЗ')
    expect(alert).toHaveTextContent(/Наём уже идёт/)
  })

  it('отказ из карточки: баннер поверх диалога, не внутри инертной части', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Открыть карточку портала ПТ-420-1' }))
    // Стабильность 80 из фикстуры: стабилизировать можно, второй раз — кулдаун
    await userEvent.click(screen.getByRole('button', { name: 'Стабилизировать' }))
    await userEvent.click(screen.getByRole('button', { name: 'Стабилизировать' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/Кулдаун стабилизации/)
    expect(alert.closest('[inert]')).toBeNull()
  })
})

describe('App: HUD, док и пауза', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('HUD сверху и док снизу на любом экране', async () => {
    renderApp()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Книга журнала' }))
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Разделы' })).toBeInTheDocument()
  })

  it('пауза: корень приложения получает is-paused и замораживает спрайты', async () => {
    const { container } = renderApp()
    const root = container.firstElementChild!
    expect(root).not.toHaveClass('is-paused')

    await userEvent.click(screen.getByRole('button', { name: 'Пауза' }))
    expect(root).toHaveClass('is-paused')

    await userEvent.click(screen.getByRole('button', { name: 'Скорость ×1' }))
    expect(root).not.toHaveClass('is-paused')
  })

  const sealButton = () => screen.getByRole('button', { name: 'Запечатать лабораторию' })

  it('«Запечатать лабораторию» открывает свиток, а не window.confirm; лаборатория пока цела', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { store } = renderApp()
    const before = store.getState().lab

    await userEvent.click(sealButton())

    const dialog = screen.getByRole('dialog', { name: 'ЗАПЕЧАТАТЬ ЛАБОРАТОРИЮ?' })
    expect(dialog).toHaveAccessibleDescription(
      'Все порталы, миры и записи книги будут стёрты. Вернуть их не получится.',
    )
    expect(confirm).not.toHaveBeenCalled()
    expect(store.getState().lab).toBe(before)
    // безопасный выбор в фокусе, а всё за свитком недоступно
    expect(within(dialog).getByRole('button', { name: 'Отмена' })).toHaveFocus()
    expect(screen.getByRole('banner').closest('[inert]')).not.toBeNull()
  })

  it('печать подтверждена: лаборатория начинается заново, свиток закрыт', async () => {
    const { store } = renderApp()

    await userEvent.click(sealButton())
    await userEvent.click(screen.getByRole('button', { name: 'Запечатать' }))

    expect(store.getState().lab.time).toBe(0)
    expect(store.getState().lab.portals).toEqual([])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('banner').closest('[inert]')).toBeNull()
  })

  it('печать отменена кнопкой или Esc: лаборатория не меняется, фокус на кнопке дока', async () => {
    const { store } = renderApp()
    const before = store.getState().lab

    await userEvent.click(sealButton())
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(sealButton()).toHaveFocus()

    await userEvent.click(sealButton())
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(sealButton()).toHaveFocus()

    expect(store.getState().lab).toBe(before)
  })
})
