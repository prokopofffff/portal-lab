import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { labWith, portal, storeWithLab, world } from '../../test/labFixtures'
import { renderScreen } from '../../test/renderScreen'
import { AtlasScreen } from './AtlasScreen'

// Четыре мира: у каждого свой порядок по изученности, посещениям и последнему посещению
const lab = labWith({
  worlds: {
    'Пепельные Топи': world('Пепельные Топи', 'ПТ-420', { studied: 3, visits: 2, lastVisit: 131 }),
    'Багровая Бездна': world('Багровая Бездна', 'ББ-310', {
      creatures: 12,
      visits: 1,
      lastVisit: 97,
    }),
    'Янтарный Сад': world('Янтарный Сад', 'ЯС-179', {
      creatures: 7,
      studied: 7,
      visits: 2,
      lastVisit: 88,
    }),
    'Шепчущее Зеркало': world('Шепчущее Зеркало', 'ШЗ-793', {
      creatures: 2,
      studied: 2,
      visits: 1,
      lastVisit: 12,
    }),
  },
  portals: [
    portal('ПТ-420-1', 'Пепельные Топи', { arch: 0, observers: 2, studyProgress: 12 }),
    portal('ПТ-420-2', 'Пепельные Топи', { arch: 1, studyProgress: 4 }),
    portal('ББ-310-1', 'Багровая Бездна', { arch: 2 }),
    portal('ЯС-179-1', 'Янтарный Сад', { status: 'closed', arch: 3 }),
    portal('ЯС-179-2', 'Янтарный Сад', { status: 'collapsed', arch: 4 }),
    portal('ШЗ-793-1', 'Шепчущее Зеркало', { arch: 5 }),
  ],
})

function cardNames(): string[] {
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '')
}

function card(name: string): HTMLElement {
  return screen.getByRole('article', { name })
}

// Значение «Подпись: значение» в карточке
function stat(article: HTMLElement, label: string): string {
  return within(article).getByText(label).textContent ?? ''
}

describe('Атлас миров (spec §9)', () => {
  it('карточка мира: шифр, существа, посещения, открыто сейчас, последнее посещение', () => {
    renderScreen(<AtlasScreen />, storeWithLab(lab))

    const topi = card('Пепельные Топи')
    expect(within(topi).getByText('ПТ-420')).toBeInTheDocument()
    expect(stat(topi, 'Изучено:')).toBe('Изучено: 3 / 9')
    expect(stat(topi, 'Посещений:')).toBe('Посещений: 2')
    expect(stat(topi, 'Открыто сейчас:')).toBe('Открыто сейчас: 2')
    expect(stat(topi, 'Последнее:')).toBe('Последнее: мин 131')
  })

  it('«открыто сейчас» не считает закрытые и схлопнувшиеся порталы', () => {
    renderScreen(<AtlasScreen />, storeWithLab(lab))

    expect(stat(card('Янтарный Сад'), 'Открыто сейчас:')).toBe('Открыто сейчас: 0')
    expect(stat(card('Багровая Бездна'), 'Открыто сейчас:')).toBe('Открыто сейчас: 1')
  })

  it('существа: прогресс следующего берётся у лучшего открытого портала мира', () => {
    renderScreen(<AtlasScreen />, storeWithLab(lab))

    // 12 из 20 наблюдателе-тиков — 60 %
    expect(
      within(card('Пепельные Топи')).getByRole('img', {
        name: 'Изучено 3 из 9, следующее изучено на 60 %',
      }),
    ).toBeInTheDocument()
    expect(
      within(card('Багровая Бездна')).getByRole('img', { name: 'Изучено 0 из 12' }),
    ).toBeInTheDocument()
  })

  it('полоска мира показывает долю изученных существ', () => {
    renderScreen(<AtlasScreen />, storeWithLab(lab))

    const topi = within(card('Пепельные Топи')).getByRole('meter', { name: 'Прогресс мира' })
    expect(topi).toHaveAttribute('aria-valuenow', '33')
    expect(within(card('Пепельные Топи')).getByText('33 %')).toBeInTheDocument()
  })

  it('метка «Изучен полностью» только у полностью изученных миров', () => {
    renderScreen(<AtlasScreen />, storeWithLab(lab))

    expect(within(card('Янтарный Сад')).getByText('ИЗУЧЕН ПОЛНОСТЬЮ')).toBeInTheDocument()
    expect(within(card('Шепчущее Зеркало')).getByText('ИЗУЧЕН ПОЛНОСТЬЮ')).toBeInTheDocument()
    expect(within(card('Пепельные Топи')).queryByText('ИЗУЧЕН ПОЛНОСТЬЮ')).not.toBeInTheDocument()
  })

  it('мир без существ не считается изученным', () => {
    const empty = labWith({
      worlds: { 'Забытый Маяк': world('Забытый Маяк', 'ЗМ-517', { creatures: 0 }) },
    })
    renderScreen(<AtlasScreen />, storeWithLab(empty))

    const maiak = card('Забытый Маяк')
    expect(within(maiak).queryByText('ИЗУЧЕН ПОЛНОСТЬЮ')).not.toBeInTheDocument()
    expect(within(maiak).getByText('0 %')).toBeInTheDocument()
  })

  it('по умолчанию миры идут по изученности: доля, затем число существ', () => {
    renderScreen(<AtlasScreen />, storeWithLab(lab))

    expect(cardNames()).toEqual([
      'Янтарный Сад',
      'Шепчущее Зеркало',
      'Пепельные Топи',
      'Багровая Бездна',
    ])
    expect(screen.getByRole('button', { name: 'по изученности' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('вкладка «по посещениям» переставляет карточки: посещения, затем последнее посещение', async () => {
    renderScreen(<AtlasScreen />, storeWithLab(lab))

    await userEvent.click(screen.getByRole('button', { name: 'по посещениям' }))

    expect(cardNames()).toEqual([
      'Пепельные Топи',
      'Янтарный Сад',
      'Багровая Бездна',
      'Шепчущее Зеркало',
    ])
    expect(screen.getByRole('button', { name: 'по посещениям' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'по изученности' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('вкладка «по последнему посещению» ставит свежие миры первыми', async () => {
    renderScreen(<AtlasScreen />, storeWithLab(lab))

    await userEvent.click(screen.getByRole('button', { name: 'по последнему посещению' }))

    expect(cardNames()).toEqual([
      'Пепельные Топи',
      'Багровая Бездна',
      'Янтарный Сад',
      'Шепчущее Зеркало',
    ])
  })

  it('«Страница мира» ведёт на страницу этого мира', async () => {
    const { route } = renderScreen(<AtlasScreen />, storeWithLab(lab), { screen: 'atlas' })

    await userEvent.click(
      within(card('Багровая Бездна')).getByRole('link', { name: /Страница мира/ }),
    )

    expect(route()).toEqual({ screen: 'world', world: 'Багровая Бездна' })
  })

  it('пустой атлас: сообщение и путь в зал, вкладок сортировки нет', async () => {
    const { route } = renderScreen(<AtlasScreen />, storeWithLab(labWith({ worlds: {} })), {
      screen: 'atlas',
    })

    expect(screen.getByText('Ни один мир ещё не открыт')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'по изученности' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'В зал лаборатории' }))

    expect(route()).toEqual({ screen: 'hall' })
  })
})
