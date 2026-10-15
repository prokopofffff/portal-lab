import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Lab, Portal } from '../../domain'
import { labWith, portal, storeWithLab, world } from '../../test/labFixtures'
import { renderScreen } from '../../test/renderScreen'
import { HallScreen } from './HallScreen'

const TOPI = 'Пепельные Топи'
const ZERK = 'Шепчущее Зеркало'
const BEZ = 'Багровая Бездна'
const worlds = {
  [TOPI]: world(TOPI, 'ПТ-420', { creatures: 9, studied: 3 }),
  [ZERK]: world(ZERK, 'ШЗ-793', { creatures: 2, studied: 2 }),
  [BEZ]: world(BEZ, 'ББ-310', { creatures: 12, studied: 0 }),
}

// Обычная работа из канваса 00-hall (первые три арки)
const work: Portal[] = [
  portal('ПТ-420-1', TOPI, {
    arch: 0,
    energy: 82,
    stability: 14,
    timeLeft: 8,
    observers: 2,
    studyProgress: 12,
  }),
  portal('ШЗ-793-1', ZERK, {
    arch: 1,
    energy: 22,
    stability: 90,
    timeLeft: 310,
    acceptedAt: 'low',
  }),
  portal('ББ-310-1', BEZ, {
    arch: 2,
    energy: 91,
    stability: 35,
    timeLeft: 46,
    questioned: { note: '' },
  }),
]

function renderHall(lab: Lab = labWith({ worlds, portals: work })) {
  const store = storeWithLab(lab)
  return { store, ...renderScreen(<HallScreen />, store) }
}

const emptyArches = () => screen.queryAllByRole('button', { name: /^Арка \d+ пуста/ })
// Ячейка арки — ближайший предок кнопки с табличкой
const cellOf = (el: HTMLElement) => el.closest('main > div > div')! as HTMLElement
const plateOf = (name: string) => cellOf(screen.getByText(name))
// jsdom без AnimationEvent: React слушает animationend под префиксом webkit
const animationEnd = (el: Element) =>
  fireEvent(el, new Event('webkitAnimationEnd', { bubbles: true }))

describe('Зал: пустая лаборатория', () => {
  it('12 пустых арок, приглашение и подсказка у первой арки', () => {
    renderHall(labWith({ worlds: {} }))
    expect(screen.getByRole('heading', { name: 'Лаборатория порталов' })).toBeInTheDocument()
    expect(screen.getByText('Порталов нет — активируйте первую арку')).toBeInTheDocument()
    expect(emptyArches()).toHaveLength(12)
    expect(screen.getByText('АРКА 1').nextSibling).toHaveTextContent('нажмите — откроется портал')
    expect(screen.getByText('АРКА 12').nextSibling).toHaveTextContent('пуста')
  })

  it('клик по пустой арке открывает портал в первой свободной арке', async () => {
    const { store } = renderHall(labWith({ worlds: {} }))
    await userEvent.click(screen.getByRole('button', { name: 'Арка 5 пуста — открыть портал' }))

    const [opened] = store.getState().lab.portals
    expect(opened).toMatchObject({ status: 'open', arch: 0 })
    expect(screen.queryByText('Порталов нет — активируйте первую арку')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `Открыть карточку портала ${opened!.name}` }),
    ).toBeInTheDocument()
    expect(emptyArches()).toHaveLength(11)
  })
})

describe('Зал: обычная работа', () => {
  it('табличка показывает все поля портала', () => {
    renderHall()
    const plate = within(plateOf('ПТ-420-1'))
    expect(plate.getByText(TOPI)).toBeInTheDocument()
    expect(plate.getByRole('meter', { name: 'Энергия' })).toHaveAttribute('aria-valuenow', '82')
    expect(plate.getByRole('meter', { name: 'Стабильность' })).toHaveAttribute(
      'aria-valuetext',
      '14 %',
    )
    expect(plate.getByRole('meter', { name: 'Время до схлопывания' })).toHaveAttribute(
      'aria-valuetext',
      '8 мин',
    )
    expect(plate.getByText('3 / 9')).toBeInTheDocument()
    expect(
      plate.getByRole('img', { name: 'Изучено 3 из 9, следующее на 60 %' }),
    ).toBeInTheDocument()
    expect(plate.getByText('КРИТИЧЕСКИЙ').parentElement).toHaveTextContent(
      'Открыт, риск КРИТИЧЕСКИЙ·87',
    )
    expect(plate.getByRole('img', { name: 'Наблюдателей на месте: 2' })).toBeInTheDocument()
    expect(
      plate.getByRole('img', { name: 'Портал, риск Критический, наблюдателей: 2' }),
    ).toBeInTheDocument()
  })

  it('пометки у арки: «под вопросом» и «принят как есть»', () => {
    renderHall()
    expect(
      within(plateOf('ББ-310-1')).getByRole('img', { name: 'Под вопросом' }),
    ).toBeInTheDocument()
    expect(
      within(plateOf('ШЗ-793-1')).getByRole('img', { name: 'Принят как есть' }),
    ).toBeInTheDocument()
    expect(within(plateOf('ПТ-420-1')).queryByRole('img', { name: 'Под вопросом' })).toBeNull()
  })

  it('«общий мир» — у порталов, открытых в один мир', () => {
    renderHall(
      labWith({
        worlds,
        portals: [...work, portal('ПТ-420-2', TOPI, { arch: 3 })],
      }),
    )
    expect(within(plateOf('ПТ-420-1')).getByText('общий мир')).toBeInTheDocument()
    expect(within(plateOf('ПТ-420-2')).getByText('общий мир')).toBeInTheDocument()
    expect(within(plateOf('ШЗ-793-1')).queryByText('общий мир')).toBeNull()
  })

  it('клик по порталу открывает его карточку', async () => {
    const { route } = renderHall()
    await userEvent.click(screen.getByRole('button', { name: 'Открыть карточку портала ББ-310-1' }))
    expect(route()).toEqual({ screen: 'portal', portal: 'ББ-310-1', back: { screen: 'hall' } })
  })

  it('рамка фокуса: пунктир только у ячейки выбранного портала', () => {
    const store = storeWithLab(labWith({ worlds, portals: work }))
    renderScreen(<HallScreen focus="ШЗ-793-1" />, store)

    expect(plateOf('ШЗ-793-1').style.outline).toBe('3px dashed var(--c-torch-light)')
    expect(plateOf('ПТ-420-1').style.outline).toBe('3px solid transparent')
    expect(plateOf('ББ-310-1').style.outline).toBe('3px solid transparent')
  })

  it('без focus рамки нет ни у кого', () => {
    renderHall()

    expect(plateOf('ПТ-420-1').style.outline).toBe('3px solid transparent')
  })

  it('фильтр «Под вопросом» приглушает остальные арки, в том числе пустые', async () => {
    renderHall()
    const toggle = screen.getByRole('checkbox', {
      name: 'Показать только порталы «под вопросом»',
    })
    expect(toggle).not.toBeChecked()
    expect(plateOf('ПТ-420-1')).toHaveStyle({ opacity: '1' })

    await userEvent.click(toggle)

    expect(toggle).toBeChecked()
    expect(plateOf('ББ-310-1')).toHaveStyle({ opacity: '1' })
    expect(plateOf('ПТ-420-1')).toHaveStyle({ opacity: '0.28' })
    expect(cellOf(emptyArches()[0]!)).toHaveStyle({ opacity: '0.28' })
  })
})

describe('Зал: все арки заняты и пауза', () => {
  it('12 открытых — баннер, пустых арок нет', () => {
    const portals = Array.from({ length: 12 }, (_, i) =>
      portal(`ПТ-420-${i + 1}`, TOPI, { arch: i }),
    )
    renderHall(labWith({ worlds, portals }))
    expect(screen.getByText('Все 12 арок заняты — открыть новый портал некуда')).toBeVisible()
    expect(emptyArches()).toHaveLength(0)
  })

  it('пауза — баннер и приглушённый зал', () => {
    const { store } = renderHall()
    expect(screen.queryByText('Пауза: время стоит, песок замер')).toBeNull()
    act(() => store.setSpeed(0))
    expect(screen.getByText('Пауза: время стоит, песок замер')).toBeVisible()
    expect(screen.getByRole('main').style.filter).toBe('brightness(.55) saturate(.6)')
  })
})

describe('Зал: портал уходит из арки', () => {
  const zerkOnly = () =>
    labWith({ worlds, portals: [portal('ШЗ-793-1', ZERK, { arch: 1, stability: 90 })] })

  it('закрытие: арку запечатывают, табличка «ЗАКРЫТ» тает, арка снова пуста', () => {
    const { store, container } = renderHall(zerkOnly())
    act(() => {
      store.dispatch({ type: 'closePortal', portal: 'ШЗ-793-1' })
    })

    expect(container.querySelector('[data-leaving="closed"]')).toBeInTheDocument()
    expect(container.querySelector('.hall-seal')).toBeInTheDocument()
    const plate = screen.getByText('ЗАКРЫТ').closest('.hall-leave-plate')!
    expect(within(plate as HTMLElement).getByText('ШЗ-793-1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Арка 2 пуста/ })).toBeNull()

    animationEnd(plate)

    expect(container.querySelector('[data-leaving]')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Арка 2 пуста — открыть портал' }),
    ).toBeInTheDocument()
  })

  it('схлопывание: портал гаснет, табличка «СХЛОПНУЛСЯ» с последними метриками', () => {
    const { store, container } = renderHall(
      labWith({ worlds, portals: [portal('ПТ-420-1', TOPI, { timeLeft: 2, stability: 50 })] }),
    )
    act(() => store.advance(2))

    expect(container.querySelector('[data-leaving="collapsed"] .hall-collapse')).toBeInTheDocument()
    const plate = screen.getByText('СХЛОПНУЛСЯ').closest('.hall-leave-plate') as HTMLElement
    expect(within(plate).getByRole('meter', { name: 'Время до схлопывания' })).toHaveAttribute(
      'aria-valuetext',
      '2 мин',
    )
  })

  it('всплывшая анимация из глубины сцену не убирает', () => {
    const { store, container } = renderHall(zerkOnly())
    act(() => {
      store.dispatch({ type: 'closePortal', portal: 'ШЗ-793-1' })
    })
    animationEnd(container.querySelector('.hall-seal__slab')!)
    expect(container.querySelector('[data-leaving="closed"]')).toBeInTheDocument()
  })

  it('новый портал в той же арке сменяет сцену сразу', () => {
    const { store, container } = renderHall(
      labWith({ worlds, portals: [portal('ШЗ-793-1', ZERK, { arch: 0 })] }),
    )
    act(() => {
      store.dispatch({ type: 'closePortal', portal: 'ШЗ-793-1' })
    })
    expect(container.querySelector('[data-leaving]')).toBeInTheDocument()

    act(() => {
      store.dispatch({ type: 'openPortal' })
    })
    expect(container.querySelector('[data-leaving]')).toBeNull()
    const opened = store.getState().lab.portals.find((p) => p.status === 'open')!
    expect(opened.arch).toBe(0)
    expect(screen.getByText(opened.name)).toBeInTheDocument()
  })

  it('печать лаборатории стирает и уходящие порталы', () => {
    const { store, container } = renderHall(zerkOnly())
    act(() => {
      store.dispatch({ type: 'closePortal', portal: 'ШЗ-793-1' })
    })
    act(() => {
      store.dispatch({ type: 'sealLab' })
    })
    expect(container.querySelector('[data-leaving]')).toBeNull()
    expect(emptyArches()).toHaveLength(12)
  })
})
