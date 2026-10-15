import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LabStoreProvider } from '../../app/hooks'
import { labWith, portal, storeWithLab, world } from '../../test/labFixtures'
import { Banner, BANNER_TIMEOUT, RejectionBanner } from './Banner'

const TOPI = 'Пепельные Топи'
// Критический портал: отправить наблюдателя и принять как есть нельзя
const lab = labWith({
  worlds: { [TOPI]: world(TOPI, 'ПТ-420') },
  portals: [portal('ПТ-420-1', TOPI, { energy: 82, stability: 14, timeLeft: 8 })],
})

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Banner', () => {
  it('отказ: role="alert", заголовок «ОТКАЗ» и текст', () => {
    render(<Banner kind="refuse" text="Нельзя" onDismiss={() => {}} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('ОТКАЗ')
    expect(alert).toHaveTextContent('Нельзя')
    expect(alert).toHaveClass('banner')
  })

  it('кнопка «скрыть» вызывает onDismiss', () => {
    const onDismiss = vi.fn()
    render(<Banner kind="refuse" text="Нельзя" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть уведомление' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('скрывается сам через 6 с', () => {
    const onDismiss = vi.fn()
    render(<Banner kind="refuse" text="Нельзя" onDismiss={onDismiss} />)
    act(() => vi.advanceTimersByTime(BANNER_TIMEOUT - 1))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(BANNER_TIMEOUT).toBe(6000)
  })

  it('размонтирование снимает таймер', () => {
    const onDismiss = vi.fn()
    const { unmount } = render(<Banner kind="refuse" text="Нельзя" onDismiss={onDismiss} />)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(BANNER_TIMEOUT))
    expect(onDismiss).not.toHaveBeenCalled()
  })
})

describe('RejectionBanner', () => {
  function renderBanner() {
    const store = storeWithLab(lab)
    render(
      <LabStoreProvider store={store}>
        <RejectionBanner />
      </LabStoreProvider>,
    )
    const refuse = () =>
      act(() => {
        store.dispatch({ type: 'sendObserver', portal: 'ПТ-420-1' })
      })
    return { store, refuse }
  }

  it('без отказа ничего не показывает', () => {
    renderBanner()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('показывает текст отказа из store; «скрыть» убирает его из очереди', () => {
    const { store, refuse } = renderBanner()
    refuse()
    expect(screen.getByRole('alert')).toHaveTextContent(store.getState().notifications[0]!.text)

    fireEvent.click(screen.getByRole('button', { name: 'Скрыть уведомление' }))
    expect(store.getState().notifications).toEqual([])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('через 6 с отказ убирается из очереди сам', () => {
    const { store, refuse } = renderBanner()
    refuse()
    act(() => vi.advanceTimersByTime(BANNER_TIMEOUT))
    expect(store.getState().notifications).toEqual([])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('новый отказ заново отсчитывает 6 с', () => {
    const { store, refuse } = renderBanner()
    refuse()
    act(() => vi.advanceTimersByTime(4000))
    refuse()
    const second = store.getState().notifications.at(-1)!.id

    act(() => vi.advanceTimersByTime(4000))
    expect(store.getState().notifications.at(-1)?.id).toBe(second)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(BANNER_TIMEOUT - 4000))
    expect(store.getState().notifications).toEqual([])
    // Таймеров не остаётся
    expect(vi.getTimerCount()).toBe(0)
  })

  it('стоит в правом верхнем углу поверх всего', () => {
    const { refuse } = renderBanner()
    refuse()
    const box = screen.getByRole('alert').parentElement!
    expect(box.style.position).toBe('fixed')
    expect(box.style.top).toBe('24px')
    expect(box.style.right).toBe('20px')
  })
})
