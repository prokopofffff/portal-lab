import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Route } from '../../app/navigation'
import { labWith, storeWithLab } from '../../test/labFixtures'
import { renderScreen } from '../../test/renderScreen'
import { Dock } from './Dock'

const TABS = ['Зал лаборатории', 'Атлас миров', 'Книга журнала']

function renderDock(route?: Route, onSeal = () => {}) {
  return renderScreen(<Dock onSeal={onSeal} />, storeWithLab(labWith({ worlds: {} })), route)
}

const current = () =>
  within(screen.getByRole('navigation', { name: 'Разделы' }))
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent)

describe('док', () => {
  it('три раздела в навигации «Разделы»', () => {
    renderDock()
    const nav = screen.getByRole('navigation', { name: 'Разделы' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(TABS)
  })

  it.each<[Route, string]>([
    [{ screen: 'hall' }, 'Зал лаборатории'],
    [{ screen: 'portal', portal: 'ПТ-420-1' }, 'Зал лаборатории'],
    [{ screen: 'atlas' }, 'Атлас миров'],
    [{ screen: 'world', world: 'Пепельные Топи' }, 'Атлас миров'],
    [{ screen: 'journal' }, 'Книга журнала'],
  ])('маршрут %j — активна вкладка «%s»', (route, tab) => {
    renderDock(route)
    expect(current()).toEqual([tab])
  })

  it('клик по вкладке переходит в раздел', async () => {
    const { route } = renderDock()
    await userEvent.click(screen.getByRole('link', { name: 'Атлас миров' }))
    expect(route()).toEqual({ screen: 'atlas' })
    expect(current()).toEqual(['Атлас миров'])

    await userEvent.click(screen.getByRole('link', { name: 'Книга журнала' }))
    expect(route()).toEqual({ screen: 'journal' })

    await userEvent.click(screen.getByRole('link', { name: 'Зал лаборатории' }))
    expect(route()).toEqual({ screen: 'hall' })
  })

  it('«Запечатать лабораторию» зовёт onSeal', async () => {
    const onSeal = vi.fn()
    renderDock(undefined, onSeal)
    await userEvent.click(screen.getByRole('button', { name: 'Запечатать лабораторию' }))
    expect(onSeal).toHaveBeenCalledTimes(1)
  })
})
