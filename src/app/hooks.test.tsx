import { act, render, renderHook, screen } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  LabStoreProvider,
  useDispatch,
  useLabSelector,
  useLabStore,
  useNotifications,
  useSpeed,
} from './hooks'
import { createLabStore, shallowEqual, type LabStore } from './store'

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)

function newStore(): LabStore {
  return createLabStore({ storage: localStorage, seed: 7, now: () => NOW })
}

function PortalCount() {
  const count = useLabSelector((s) => s.lab.portals.length)
  return <p>Порталов: {count}</p>
}

function renderWith(store: LabStore, ui: ReactNode) {
  return render(<LabStoreProvider store={store}>{ui}</LabStoreProvider>)
}

describe('React-хуки store лаборатории', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('useLabSelector перерисовывает компонент после команды', () => {
    const store = newStore()
    renderWith(store, <PortalCount />)
    expect(screen.getByText('Порталов: 0')).toBeInTheDocument()

    act(() => {
      store.dispatch({ type: 'openPortal' })
    })

    expect(screen.getByText('Порталов: 1')).toBeInTheDocument()
  })

  it('компонент со срезом staff.free не перерисовывается от тиков', () => {
    const store = newStore()
    let renders = 0
    function FreeStaff() {
      renders++
      const free = useLabSelector((s) => s.lab.staff.free)
      return <p>Свободно: {free}</p>
    }
    renderWith(store, <FreeStaff />)
    const initial = renders

    act(() => {
      store.advance(2)
    })

    expect(store.getState().lab.time).toBe(2)
    expect(renders).toBe(initial)
  })

  it('производный объект с shallowEqual не зацикливается и не перерисовывает без изменений', () => {
    const store = newStore()
    let renders = 0
    function Counts() {
      renders++
      const counts = useLabSelector(
        (s) => ({ portals: s.lab.portals.length, free: s.lab.staff.free }),
        shallowEqual,
      )
      return (
        <p>
          {counts.portals}/{counts.free}
        </p>
      )
    }
    renderWith(store, <Counts />)
    const initial = renders

    act(() => {
      store.advance(1)
    })
    expect(renders).toBe(initial)

    act(() => {
      store.dispatch({ type: 'openPortal' })
    })
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('в StrictMode срез обновляется после команды и не перерисовывается от тика', () => {
    const store = newStore()
    let renders = 0
    function Count() {
      renders++
      const count = useLabSelector((s) => s.lab.portals.length)
      return <p>Порталов: {count}</p>
    }
    render(
      <StrictMode>
        <LabStoreProvider store={store}>
          <Count />
        </LabStoreProvider>
      </StrictMode>,
    )
    expect(screen.getByText('Порталов: 0')).toBeInTheDocument()

    act(() => {
      store.dispatch({ type: 'openPortal' })
    })
    expect(screen.getByText('Порталов: 1')).toBeInTheDocument()

    // StrictMode удваивает рендеры, поэтому сравниваем счётчик до и после тика
    const beforeAdvance = renders
    act(() => {
      store.advance(1)
    })
    expect(store.getState().lab.time).toBe(1)
    expect(renders).toBe(beforeAdvance)
  })

  it('срез, зависящий от пропсов, пересчитывается при их смене', () => {
    const store = newStore()
    store.dispatch({ type: 'stabilize', portal: 'XX-000-1' })
    function LogKind(props: { index: number }) {
      const kind = useLabSelector((s) => s.lab.log[props.index]?.kind ?? 'нет')
      return <p>Запись: {kind}</p>
    }
    const { rerender } = renderWith(store, <LogKind index={0} />)
    expect(screen.getByText('Запись: rejection')).toBeInTheDocument()

    rerender(
      <LabStoreProvider store={store}>
        <LogKind index={1} />
      </LabStoreProvider>,
    )

    expect(screen.getByText('Запись: нет')).toBeInTheDocument()
  })

  it('useSpeed отдаёт скорость и сеттер, перерисовывая компонент', () => {
    const store = newStore()
    function Speed() {
      const [speed, setSpeed] = useSpeed()
      return <button onClick={() => setSpeed(5)}>Скорость: {speed}</button>
    }
    renderWith(store, <Speed />)
    expect(screen.getByText('Скорость: 1')).toBeInTheDocument()

    act(() => {
      screen.getByText('Скорость: 1').click()
    })

    expect(store.getState().speed).toBe(5)
    expect(screen.getByText('Скорость: 5')).toBeInTheDocument()
  })

  it('useNotifications показывает отказы и убирает их после dismissNotification', () => {
    const store = newStore()
    function Texts() {
      const notifications = useNotifications()
      return <p>{notifications.length ? notifications.map((n) => n.text).join('; ') : 'Пусто'}</p>
    }
    renderWith(store, <Texts />)
    expect(screen.getByText('Пусто')).toBeInTheDocument()

    act(() => {
      store.dispatch({ type: 'stabilize', portal: 'XX-000-1' })
    })
    expect(screen.getByText('Портал не открыт')).toBeInTheDocument()

    act(() => {
      store.dismissNotification(store.getState().notifications[0]!.id)
    })
    expect(screen.getByText('Пусто')).toBeInTheDocument()
  })

  it('useNotifications держит ссылку, пока очередь не менялась', () => {
    const store = newStore()
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => <LabStoreProvider store={store}>{children}</LabStoreProvider>,
    })
    const first = result.current

    act(() => {
      store.advance(1)
    })

    expect(result.current).toBe(first)
  })

  it('useDispatch отправляет команду в store', () => {
    const store = newStore()
    const { result } = renderHook(() => useDispatch(), {
      wrapper: ({ children }) => <LabStoreProvider store={store}>{children}</LabStoreProvider>,
    })

    act(() => {
      result.current({ type: 'openPortal' })
    })

    expect(store.getState().lab.portals).toHaveLength(1)
  })

  it('useLabStore вне провайдера бросает ошибку', () => {
    expect(() => renderHook(() => useLabStore())).toThrow('useLabStore: нет LabStoreProvider')
  })
})
