import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { labWith, logEntry, portal, storeWithLab, world } from '../../test/labFixtures'
import { renderScreen } from '../../test/renderScreen'
import { WorldScreen } from './WorldScreen'

const TOPI = 'Пепельные Топи'

const lab = labWith({
  worlds: {
    [TOPI]: world(TOPI, 'ПТ-420', { studied: 3, visits: 4, lastVisit: 131 }),
    'Багровая Бездна': world('Багровая Бездна', 'ББ-310', { visits: 1, lastVisit: 97 }),
  },
  portals: [
    // Критический по жёсткому правилу: до схлопывания 8 мин
    portal('ПТ-420-1', TOPI, {
      arch: 0,
      energy: 90,
      stability: 10,
      timeLeft: 8,
      observers: 2,
      studyProgress: 12,
    }),
    portal('ПТ-420-2', TOPI, { arch: 1 }),
    portal('ПТ-420-3', TOPI, { status: 'closed', arch: 2 }),
    portal('ПТ-420-4', TOPI, { status: 'collapsed', arch: 3 }),
    portal('ББ-310-1', 'Багровая Бездна', { arch: 4 }),
  ],
  log: [
    logEntry(120, 'Открыт портал ПТ-420-1 — первое посещение', {
      kind: 'action',
      world: TOPI,
      portal: 'ПТ-420-1',
    }),
    logEntry(126, 'Изучено существо в мире Пепельные Топи', { world: TOPI }),
    logEntry(127, 'Открыт портал ББ-310-1 — первое посещение', {
      kind: 'action',
      world: 'Багровая Бездна',
      portal: 'ББ-310-1',
    }),
    logEntry(130, 'Отказ «Стабилизировать» ПТ-420-2: кулдаун', {
      kind: 'rejection',
      world: TOPI,
      portal: 'ПТ-420-2',
    }),
  ],
})

const route = { screen: 'world', world: TOPI } as const

function renderWorld(worldName = TOPI) {
  return renderScreen(<WorldScreen world={worldName} />, storeWithLab(lab), route)
}

function row(portalName: string): HTMLElement {
  return screen.getByRole('link', { name: new RegExp(portalName) })
}

describe('Страница мира (spec §9)', () => {
  it('шапка: имя, шифр, посещения, открыто сейчас, последнее посещение', () => {
    renderWorld()

    expect(screen.getByRole('heading', { level: 1, name: TOPI })).toBeInTheDocument()
    expect(screen.getByText('ПТ-420')).toBeInTheDocument()
    const stats = screen.getByRole('group', { name: 'Сводка мира' })
    expect(within(stats).getByText('Посещений')).toBeInTheDocument()
    expect(stats).toHaveTextContent('4')
    expect(stats).toHaveTextContent('2')
    expect(stats).toHaveTextContent('мин 131')
  })

  it('существа: изучено из всего, общий прогресс и прогресс следующего существа', () => {
    renderWorld()

    expect(screen.getByText('СУЩЕСТВА · ИЗУЧЕНО 3 ИЗ 9')).toBeInTheDocument()
    expect(screen.getByText('Прогресс мира: 33 %')).toBeInTheDocument()
    // Следующее — четвёртое; у лучшего портала 12 из 20 тиков
    expect(screen.getByText('существо №4: 60 %')).toBeInTheDocument()
    // Плитки кадра 12: три изученных по имени, изучаемое, остальные неизвестны
    const tiles = within(screen.getByRole('list', { name: 'Существа мира' })).getAllByRole(
      'listitem',
    )
    expect(tiles.map((t) => t.textContent)).toEqual([
      'Пепельный слизень',
      'Рогатый бес',
      'Серый призрак',
      'Изучается · 60 %',
      ...Array(5).fill('???'),
    ])
    expect(tiles.map((t) => t.dataset.creature)).toEqual([
      'known',
      'known',
      'known',
      'study',
      ...Array(5).fill('unknown'),
    ])
  })

  it('существа: без прогресса изучаемой плитки нет; мир без существ — подпись', () => {
    const { unmount } = renderWorld('Багровая Бездна')
    const tiles = within(screen.getByRole('list', { name: 'Существа мира' })).getAllByRole(
      'listitem',
    )
    expect(tiles.map((t) => t.dataset.creature)).toEqual(Array(9).fill('unknown'))
    unmount()

    const EMPTY = 'Безмолвный Курган'
    const bare = labWith({ worlds: { [EMPTY]: world(EMPTY, 'БК-001', { creatures: 0 }) } })
    renderScreen(<WorldScreen world={EMPTY} />, storeWithLab(bare), {
      screen: 'world',
      world: EMPTY,
    })
    expect(screen.getByRole('img', { name: 'Существ нет' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Существа мира' })).not.toBeInTheDocument()
  })

  it('все порталы мира: открытые с риском, закрытые и схлопнувшиеся в архиве', () => {
    renderWorld()

    expect(screen.getAllByRole('link', { name: /ПТ-420-\d/ })).toHaveLength(4)
    expect(screen.queryByRole('link', { name: /ББ-310-1/ })).not.toBeInTheDocument()
  })

  it('открытый портал: статус, время до схлопывания, уровень и балл риска', () => {
    renderWorld()

    const critical = row('ПТ-420-1')
    expect(critical).toHaveTextContent('Открыт, идёт изучение · схлопнется через 8 мин')
    expect(critical).toHaveTextContent('КРИТИЧЕСКИЙ · 91')
    expect(
      within(critical).getByRole('img', { name: 'Портал, риск Критический, наблюдателей: 2' }),
    ).toBeInTheDocument()

    const calm = row('ПТ-420-2')
    expect(calm).toHaveTextContent('Открыт · схлопнется через 200 мин')
    expect(calm).toHaveTextContent('НИЗКИЙ · 20')
  })

  it('архив: закрытый и схлопнувшийся портал без риска и без времени', () => {
    renderWorld()

    const closed = row('ПТ-420-3')
    expect(closed).toHaveTextContent('Закрыт')
    expect(closed).toHaveTextContent('ЗАКРЫТ / СХЛОПНУЛСЯ')
    expect(closed).not.toHaveTextContent('схлопнется через')
    expect(within(closed).getByRole('img', { name: 'Портал погас' })).toBeInTheDocument()
    expect(closed).not.toHaveTextContent(/·\s*\d+/)

    const collapsed = row('ПТ-420-4')
    expect(collapsed).toHaveTextContent('Схлопнулся')
    expect(collapsed).not.toHaveTextContent('КРИТИЧЕСКИЙ')
  })

  it('открытые порталы идут раньше архива', () => {
    renderWorld()

    const names = screen
      .getAllByRole('link', { name: /ПТ-420-\d/ })
      .map((a) => /ПТ-420-\d/.exec(a.textContent ?? '')?.[0])
    expect(names).toEqual(['ПТ-420-1', 'ПТ-420-2', 'ПТ-420-3', 'ПТ-420-4'])
  })

  it('изучение общее: плашка, когда в мир открыто несколько порталов', () => {
    renderWorld()

    expect(
      screen.getByText('Изучение общее для обоих открытых порталов: 3 из 9'),
    ).toBeInTheDocument()
  })

  it('плашки нет, если открыт один портал', () => {
    renderWorld('Багровая Бездна')

    expect(screen.queryByText(/Изучение общее/)).not.toBeInTheDocument()
  })

  it('история мира: записи журнала только этого мира, системные — бледным курсивом', () => {
    renderWorld()

    const history = screen.getByRole('list', { name: 'История мира' })
    const items = within(history).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      'мин 120Открыт портал ПТ-420-1 — первое посещение',
      'мин 126Изучено существо в мире Пепельные Топи',
      'мин 130Отказ «Стабилизировать» ПТ-420-2: кулдаун',
    ])
    expect(within(items[1]!).getByText('Изучено существо в мире Пепельные Топи')).toHaveStyle({
      fontStyle: 'italic',
    })
    expect(within(items[0]!).getByText(/Открыт портал/)).toHaveStyle({ fontStyle: 'normal' })
  })

  it('история мира: отказ тем же чернилом, что в журнале', () => {
    renderWorld()

    const history = screen.getByRole('list', { name: 'История мира' })
    const items = within(history).getAllByRole('listitem')
    expect(within(items[2]!).getByText(/Отказ/)).toHaveStyle({ color: 'var(--c-ink-rejection)' })
    expect(within(items[0]!).getByText(/Открыт портал/)).toHaveStyle({
      color: 'var(--c-ink-title)',
    })
  })

  it('пустая история мира не ломает страницу', () => {
    renderScreen(<WorldScreen world="Багровая Бездна" />, storeWithLab({ ...lab, log: [] }), route)

    expect(screen.getByRole('list', { name: 'История мира' })).toBeEmptyDOMElement()
  })

  it('строка портала ведёт в карточку портала', async () => {
    const { route: current } = renderWorld()

    await userEvent.click(row('ПТ-420-2'))

    expect(current()).toEqual({ screen: 'portal', portal: 'ПТ-420-2' })
  })

  it('архивный портал тоже открывается (только просмотр)', async () => {
    const { route: current } = renderWorld()

    await userEvent.click(row('ПТ-420-3'))

    expect(current()).toEqual({ screen: 'portal', portal: 'ПТ-420-3' })
  })

  it('«← Атлас миров» возвращает в атлас', async () => {
    const { route: current } = renderWorld()

    await userEvent.click(screen.getByRole('link', { name: '← Атлас миров' }))

    expect(current()).toEqual({ screen: 'atlas' })
  })

  it('неизвестный мир: сообщение и путь назад', async () => {
    const { route: current } = renderWorld('Нет Такого')

    expect(screen.getByText('Такого мира нет в атласе')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: '← Атлас миров' }))
    expect(current()).toEqual({ screen: 'atlas' })
  })
})
