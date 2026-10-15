import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LabStoreProvider } from '../../app/hooks'
import type { Notification, NotificationKind } from '../../app/notifications'
import { createLabStore, type LabStore } from '../../app/store'
import { labWith, portal, storeWithLab, world } from '../../test/labFixtures'
import { Banner, BANNER_TIMEOUT, NotificationStack } from './Banner'

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

// Заголовок и имя CSS-переменной токена каждого вида (канвас 24-c-banner)
const LOOKS: [NotificationKind, string, string][] = [
  ['refuse', 'ОТКАЗ', 'refuse'],
  ['collapse', 'ПОРТАЛ СХЛОПНУЛСЯ', 'collapse'],
  ['lost', 'НАБЛЮДАТЕЛИ ПОТЕРЯНЫ', 'lost'],
  ['studied', 'МИР ИЗУЧЕН', 'studied'],
  ['hired', 'НАЁМ ЗАВЕРШЁН', 'hired'],
]

describe('Banner', () => {
  it.each(LOOKS)(
    'вид %s: заголовок «%s», рамка, плашка и значок своего цвета',
    (kind, title, token) => {
      const { container } = render(<Banner kind={kind} text="Текст" onDismiss={() => {}} />)
      const banner = screen.getByText(title).closest('.banner') as HTMLElement
      expect(banner).toHaveTextContent('Текст')
      expect(screen.getByText(title)).toHaveStyle({ color: `var(--c-banner-${token}-icon)` })
      const html = container.innerHTML
      expect(html).toContain(`background: var(--c-banner-${token})`)
      expect(html).toContain(`background: var(--c-banner-${token}-dark)`)
      // Значок вида (не крестик закрытия) залит цветом значка вида
      const icon = container.querySelector('svg path[fill]')!
      expect(icon.getAttribute('fill')).toBe(`var(--c-banner-${token}-icon)`)
    },
  )

  it('отказ: role="alert", остальные виды: role="status"', () => {
    const { unmount } = render(<Banner kind="refuse" text="Нельзя" onDismiss={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('ОТКАЗ')
    expect(screen.queryByRole('status')).toBeNull()
    unmount()
    for (const kind of ['collapse', 'lost', 'studied', 'hired'] as const) {
      const view = render(<Banner kind={kind} text="Событие" onDismiss={() => {}} />)
      expect(screen.getByRole('status')).toHaveClass('banner')
      expect(screen.queryByRole('alert')).toBeNull()
      view.unmount()
    }
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

// Store с заранее заданной очередью: домен не умеет выдать все виды сразу, а стопке это не важно
function storeWithQueue(initial: Notification[]): {
  store: LabStore
  push: (n: Notification) => void
} {
  const real = createLabStore({
    storage: { getItem: () => null, setItem: () => {} },
    seed: 1,
    now: () => 0,
  })
  let queue = initial
  const listeners = new Set<() => void>()
  let state = { ...real.getState(), notifications: queue }
  const store: LabStore = {
    ...real,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dismissNotification(id) {
      set(queue.filter((n) => n.id !== id))
    },
  }
  function set(next: Notification[]) {
    queue = next
    state = { ...state, notifications: queue }
    for (const l of listeners) l()
  }
  return { store, push: (n) => act(() => set([...queue, n])) }
}

const note = (id: number, kind: NotificationKind, text = `Текст ${id}`): Notification => ({
  id,
  kind,
  text,
})

describe('NotificationStack', () => {
  function renderStack(initial: Notification[], cardOpen?: boolean) {
    const view = storeWithQueue(initial)
    const { container } = render(
      <LabStoreProvider store={view.store}>
        <NotificationStack cardOpen={cardOpen} />
      </LabStoreProvider>,
    )
    return { ...view, container }
  }
  const titles = (c: HTMLElement) =>
    [...c.querySelectorAll('.banner')].map((b) => b.textContent ?? '')

  it('без уведомлений ничего не показывает', () => {
    const { container } = renderStack([])
    expect(container.querySelector('.banner')).toBeNull()
  })

  it('все записи очереди по порядку прихода: новейшая внизу', () => {
    const { container } = renderStack([note(1, 'refuse'), note(2, 'collapse'), note(3, 'hired')])
    const t = titles(container)
    expect(t).toHaveLength(3)
    expect(t[0]).toContain('ОТКАЗ')
    expect(t[1]).toContain('ПОРТАЛ СХЛОПНУЛСЯ')
    expect(t[2]).toContain('НАЁМ ЗАВЕРШЁН')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })

  it('стопка стоит в классе banner-stack, а не в инлайн-стилях', () => {
    const { container } = renderStack([note(1, 'lost')])
    const stack = container.querySelector('.banner-stack') as HTMLElement
    expect(stack).not.toBeNull()
    expect(stack.getAttribute('style') ?? '').not.toMatch(/position|top|right|width|z-index/)
  })

  it('при открытой карточке стопка получает модификатор banner-stack--card', () => {
    const closed = renderStack([note(1, 'lost')])
    expect(closed.container.querySelector('.banner-stack')).not.toHaveClass('banner-stack--card')
    cleanup()
    const open = renderStack([note(1, 'lost')], true)
    expect(open.container.querySelector('.banner-stack')).toHaveClass('banner-stack--card')
  })

  it('«скрыть» убирает только свою запись', () => {
    const { store } = renderStack([note(1, 'refuse'), note(2, 'lost'), note(3, 'studied')])
    const lost = screen.getByText('НАБЛЮДАТЕЛИ ПОТЕРЯНЫ').closest('.banner') as HTMLElement
    fireEvent.click(within(lost).getByRole('button', { name: 'Скрыть уведомление' }))
    expect(store.getState().notifications.map((n) => n.id)).toEqual([1, 3])
    expect(screen.queryByText('НАБЛЮДАТЕЛИ ПОТЕРЯНЫ')).toBeNull()
    expect(screen.getByText('МИР ИЗУЧЕН')).toBeInTheDocument()
  })

  it('через 6 с запись убирается сама, соседи с другим временем прихода остаются', () => {
    const { store, push } = renderStack([note(1, 'refuse')])
    act(() => vi.advanceTimersByTime(4000))
    push(note(2, 'collapse'))
    act(() => vi.advanceTimersByTime(2000))
    expect(store.getState().notifications.map((n) => n.id)).toEqual([2])
    act(() => vi.advanceTimersByTime(4000 - 1))
    expect(store.getState().notifications.map((n) => n.id)).toEqual([2])
    act(() => vi.advanceTimersByTime(1))
    expect(store.getState().notifications).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('новая запись не сбрасывает таймеры старых', () => {
    const { store, push } = renderStack([note(1, 'hired')])
    for (let id = 2; id <= 4; id++) {
      act(() => vi.advanceTimersByTime(1000))
      push(note(id, 'studied'))
    }
    // 3 с с прихода первой + ещё 3 с: первая живёт ровно 6 с с монтирования
    act(() => vi.advanceTimersByTime(2999))
    expect(store.getState().notifications.map((n) => n.id)).toContain(1)
    act(() => vi.advanceTimersByTime(1))
    expect(store.getState().notifications.map((n) => n.id)).toEqual([2, 3, 4])
  })

  it('отказ из настоящего store: показывается и уходит по таймеру', () => {
    const store = storeWithLab(lab)
    render(
      <LabStoreProvider store={store}>
        <NotificationStack />
      </LabStoreProvider>,
    )
    act(() => {
      store.dispatch({ type: 'sendObserver', portal: 'ПТ-420-1' })
    })
    expect(screen.getByRole('alert')).toHaveTextContent(store.getState().notifications[0]!.text)
    act(() => vi.advanceTimersByTime(BANNER_TIMEOUT))
    expect(store.getState().notifications).toEqual([])
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
