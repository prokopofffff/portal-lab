import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Route } from '../../app/navigation'
import { labWith, storeWithLab } from '../../test/labFixtures'
import { renderScreen } from '../../test/renderScreen'
import { Dock } from './Dock'

const TABS = ['Зал лаборатории', 'Атлас миров', 'Книга журнала', 'AI Worklog']

function renderDock(route?: Route, onSeal = () => {}) {
  return renderScreen(<Dock onSeal={onSeal} />, storeWithLab(labWith({ worlds: {} })), route)
}

const current = () =>
  within(screen.getByRole('navigation', { name: 'Разделы' }))
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent)

describe('док', () => {
  it('четыре раздела в навигации «Разделы»', () => {
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
    [{ screen: 'portal', portal: 'ПТ-420-1', back: { screen: 'hall' } }, 'Зал лаборатории'],
    [
      { screen: 'portal', portal: 'ПТ-420-1', back: { screen: 'world', world: 'Пепельные Топи' } },
      'Атлас миров',
    ],
    [{ screen: 'portal', portal: 'ПТ-420-1', back: { screen: 'journal' } }, 'Книга журнала'],
    [{ screen: 'atlas' }, 'Атлас миров'],
    [{ screen: 'world', world: 'Пепельные Топи' }, 'Атлас миров'],
    [{ screen: 'journal' }, 'Книга журнала'],
    [{ screen: 'worklog' }, 'AI Worklog'],
    [{ screen: 'portal', portal: 'ПТ-420-1', back: { screen: 'worklog' } }, 'AI Worklog'],
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

    await userEvent.click(screen.getByRole('link', { name: 'AI Worklog' }))
    expect(route()).toEqual({ screen: 'worklog' })
    expect(current()).toEqual(['AI Worklog'])

    await userEvent.click(screen.getByRole('link', { name: 'Зал лаборатории' }))
    expect(route()).toEqual({ screen: 'hall' })
  })

  it('«Запечатать лабораторию» зовёт onSeal', async () => {
    const onSeal = vi.fn()
    renderDock(undefined, onSeal)
    await userEvent.click(screen.getByRole('button', { name: 'Запечатать лабораторию' }))
    expect(onSeal).toHaveBeenCalledTimes(1)
  })

  it('«Обучение» есть только с onTour и зовёт его', async () => {
    renderDock()
    expect(screen.queryByRole('button', { name: 'Обучение' })).not.toBeInTheDocument()
    cleanup()

    const onTour = vi.fn()
    renderScreen(<Dock onSeal={() => {}} onTour={onTour} />, storeWithLab(labWith({ worlds: {} })))
    await userEvent.click(screen.getByRole('button', { name: 'Обучение' }))
    expect(onTour).toHaveBeenCalledTimes(1)
  })
})
