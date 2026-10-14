// Привязка store лаборатории к React через useSyncExternalStore (docs/spec.md §1)
// Провайдер и хуки — один модуль по контракту; fast refresh этого файла даёт полную перезагрузку
/* oxlint-disable react/only-export-components */
import { createContext, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react'
import type { LabState, LabStore, Rejection, Speed } from './store'

const LabStoreContext = createContext<LabStore | null>(null)

// Даёт store всем компонентам приложения
export function LabStoreProvider(props: { store: LabStore; children: ReactNode }) {
  return <LabStoreContext.Provider value={props.store}>{props.children}</LabStoreContext.Provider>
}

// Store из провайдера; вне провайдера — ошибка
export function useLabStore(): LabStore {
  const store = useContext(LabStoreContext)
  if (store === null) throw new Error('useLabStore: нет LabStoreProvider')
  return store
}

// Срез состояния; компонент перерисовывается, только когда срез изменился (по isEqual)
export function useLabSelector<T>(
  selector: (state: LabState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const store = useLabStore()
  const cache = useRef<{ state: LabState; selector: typeof selector; selection: T } | null>(null)

  // Тот же state и селектор — тот же срез; равный по isEqual срез — прежняя ссылка
  function getSnapshot(): T {
    const state = store.getState()
    const cached = cache.current
    if (cached !== null && cached.state === state && cached.selector === selector) {
      return cached.selection
    }
    const next = selector(state)
    const selection = cached !== null && isEqual(cached.selection, next) ? cached.selection : next
    cache.current = { state, selector, selection }
    return selection
  }

  return useSyncExternalStore(store.subscribe, getSnapshot)
}

// Отправка команды смотрителя (spec §5)
export function useDispatch(): LabStore['dispatch'] {
  return useLabStore().dispatch
}

// Последний отказ команды; null — показывать нечего
export function useRejection(): Rejection | null {
  return useLabSelector((state) => state.rejection)
}

// Скорость симуляции и её смена: для кнопок HUD
export function useSpeed(): [Speed, LabStore['setSpeed']] {
  const speed = useLabSelector((state) => state.speed)
  return [speed, useLabStore().setSpeed]
}
