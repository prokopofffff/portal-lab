import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Lab } from '../../domain'
import { labWith, portal, storeWithLab, world } from '../../test/labFixtures'
import { renderScreen } from '../../test/renderScreen'
import { Hud } from './Hud'

const TOPI = 'Пепельные Топи'
const ZERK = 'Шепчущее Зеркало'

function renderHud(lab: Lab = labWith({ worlds: {} })) {
  const store = storeWithLab(lab)
  return { store, ...renderScreen(<Hud />, store) }
}

const slotNames = () => screen.getAllByRole('img').map((el) => el.getAttribute('aria-label'))

// Ячейка счётчика по подписи
const stat = (label: string) => screen.getByText(label).parentElement!

describe('HUD: время и скорость', () => {
  it('показывает минуты лаборатории', () => {
    renderHud()
    // Число набрано пиксельным шрифтом внутри строки «мин …»
    expect(screen.getByText('143').parentElement).toHaveTextContent(/^мин 143$/)
    expect(screen.getByText('ВРЕМЯ')).toBeInTheDocument()
  })

  it('кнопки скорости: нажата ×1; «Пауза» ставит время на паузу и приглушает HUD', async () => {
    const { store } = renderHud()
    const pause = screen.getByRole('button', { name: 'Пауза' })
    expect(screen.getByRole('button', { name: 'Скорость ×1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    for (const name of ['Пауза', 'Скорость ×5', 'Скорость ×20']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.getByRole('banner')).toHaveClass('hud-live')
    expect(screen.getByText('СКОРОСТЬ')).toBeInTheDocument()

    await userEvent.click(pause)

    expect(store.getState().speed).toBe(0)
    expect(pause).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('СКОРОСТЬ · ПАУЗА')).toBeInTheDocument()
    const root = screen.getByRole('banner')
    expect(root).toHaveClass('hud-paused')
    expect(root.style.filter).toBe('brightness(.72) saturate(.7)')
  })

  it('×20 ставит скорость 20', async () => {
    const { store } = renderHud()
    await userEvent.click(screen.getByRole('button', { name: 'Скорость ×20' }))
    expect(store.getState().speed).toBe(20)
  })
})

describe('HUD: наблюдатели', () => {
  it('новая лаборатория: трое свободных, два пустых слота, потерь нет', () => {
    renderHud()
    expect(slotNames()).toEqual([
      'Наблюдатель свободен',
      'Наблюдатель свободен',
      'Наблюдатель свободен',
      'Пустой слот',
      'Пустой слот',
      'Потеряно наблюдателей: 0',
    ])
    expect(screen.getByText('×0')).toBeInTheDocument()
  })

  it('свободный, трое на месте, наём в пути с полоской прогресса; двое потеряны', () => {
    const { container } = renderHud(
      labWith({
        worlds: { [TOPI]: world(TOPI, 'ПТ-420') },
        portals: [portal('ПТ-420-1', TOPI, { observers: 3 })],
        staff: { free: 1, hireTicksLeft: 8, lost: 2 },
      }),
    )
    expect(slotNames()).toEqual([
      'Наблюдатель свободен',
      'Наблюдатель на месте, в портале',
      'Наблюдатель на месте, в портале',
      'Наблюдатель на месте, в портале',
      'Наблюдатель в пути, идёт найм',
      'Потеряно наблюдателей: 2',
    ])
    expect(screen.getByText('×2')).toBeInTheDocument()
    const fill = container.querySelector<HTMLElement>('.hud-hire-bar > div')!
    expect(fill.style.width).toBe('60%')
  })

  it('«Нанять» запускает наём: появляется слот «в пути»', async () => {
    renderHud()
    const hire = screen.getByRole('button', { name: 'Нанять' })
    expect(hire).not.toHaveAttribute('title')
    expect(hire).not.toHaveAttribute('aria-disabled')

    await userEvent.click(hire)

    expect(screen.getAllByRole('img', { name: 'Наблюдатель в пути, идёт найм' })).toHaveLength(1)
  })

  it('наём недоступен: кнопка приглушена, причина в подсказке, клик даёт отказ', async () => {
    const { store } = renderHud(
      labWith({ worlds: {}, staff: { free: 5, hireTicksLeft: 0, lost: 0 } }),
    )
    const hire = screen.getByRole('button', { name: 'Нанять' })
    expect(hire).toHaveAttribute('title', 'Штат полон: 5 из 5')
    expect(hire).toHaveAttribute('aria-disabled', 'true')
    expect(hire.style.opacity).toBe('0.5')

    await userEvent.click(hire)

    expect(store.getState().notifications).toEqual([
      { id: 1, kind: 'refuse', text: 'Штат полон: 5 из 5' },
    ])
  })
})

describe('HUD: счётчики сводки', () => {
  it('числа из сводки; критический подсвечен, открытых меньше предела', () => {
    renderHud(
      labWith({
        worlds: {
          [TOPI]: world(TOPI, 'ПТ-420', { creatures: 9, studied: 3 }),
          [ZERK]: world(ZERK, 'ШЗ-793', { creatures: 5, studied: 5 }),
        },
        portals: [
          portal('ПТ-420-1', TOPI),
          portal('ПТ-420-2', TOPI, { arch: 1, stability: 10 }),
          portal('ШЗ-793-1', ZERK, { arch: 2, status: 'closed' }),
          portal('ШЗ-793-2', ZERK, { arch: 3, status: 'collapsed' }),
          portal('ПТ-420-3', TOPI, { arch: 4, status: 'collapsed' }),
        ],
      }),
    )
    const values = Object.fromEntries(
      ['ОТКРЫТО', 'КРИТИЧЕСКИХ', 'ЗАКРЫТО', 'СХЛОПНУЛОСЬ', 'МИРОВ', 'ИЗУЧЕНО СУЩЕСТВ'].map(
        (label) => [label, stat(label).lastElementChild!.textContent],
      ),
    )
    expect(values).toEqual({
      ОТКРЫТО: '2 / 12',
      КРИТИЧЕСКИХ: '1',
      ЗАКРЫТО: '1',
      СХЛОПНУЛОСЬ: '2',
      МИРОВ: '2',
      'ИЗУЧЕНО СУЩЕСТВ': '8 / 14',
    })
    expect(stat('КРИТИЧЕСКИХ')).toHaveAttribute('data-alert', 'critical')
    expect(stat('ОТКРЫТО')).not.toHaveAttribute('data-alert')
    expect(stat('ЗАКРЫТО')).not.toHaveAttribute('data-alert')
  })

  it('открыто 12 из 12 — счётчик подсвечен; критических нет — без подсветки', () => {
    const portals = Array.from({ length: 12 }, (_, arch) =>
      portal(`ПТ-420-${arch + 1}`, TOPI, { arch }),
    )
    renderHud(labWith({ worlds: { [TOPI]: world(TOPI, 'ПТ-420') }, portals }))
    expect(stat('ОТКРЫТО')).toHaveAttribute('data-alert', 'high')
    expect(stat('ОТКРЫТО').lastElementChild).toHaveTextContent('12 / 12')
    expect(stat('КРИТИЧЕСКИХ')).not.toHaveAttribute('data-alert')
  })
})
