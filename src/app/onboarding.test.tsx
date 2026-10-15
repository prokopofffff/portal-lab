import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useLabSelector, useLabStore } from './hooks'
import { ONBOARDING_KEY, OnboardingProvider, onboardingSeen, useOnboarding } from './onboarding'
import { createLabStore } from './store'

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

function setup(offer = false) {
  const storage = fakeStorage()
  const store = createLabStore({ storage, seed: 1, now: () => 0 })
  store.setSpeed(5)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <OnboardingProvider store={store} storage={storage} now={() => 0} offer={offer}>
      {children}
    </OnboardingProvider>
  )
  const { result } = renderHook(
    () => ({
      onboarding: useOnboarding()!,
      active: useLabStore(),
      portals: useLabSelector((state) => state.lab.portals.length),
    }),
    { wrapper },
  )
  return { storage, store, result }
}

describe('флаг обучения', () => {
  it('нет флага — не видели; есть — видели', () => {
    expect(onboardingSeen(fakeStorage())).toBe(false)
    expect(onboardingSeen(fakeStorage({ [ONBOARDING_KEY]: '1' }))).toBe(true)
  })

  it('хранилище бросает — считаем, что видели', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {},
    }
    expect(onboardingSeen(broken)).toBe(true)
  })
})

describe('OnboardingProvider', () => {
  it('без обучения отдаёт настоящий store', () => {
    const { store, result } = setup()
    expect(result.current.active).toBe(store)
    expect(result.current.onboarding.tour).toBeNull()
    expect(result.current.onboarding.offer).toBe(false)
  })

  it('«Пропустить» прячет приглашение и ставит флаг', () => {
    const { storage, result } = setup(true)
    expect(result.current.onboarding.offer).toBe(true)
    act(() => result.current.onboarding.skip())
    expect(result.current.onboarding.offer).toBe(false)
    expect(storage.items.get(ONBOARDING_KEY)).toBe('1')
  })

  it('обучение идёт в песочнице на паузе, настоящая лаборатория стоит и не меняется', () => {
    const { store, storage, result } = setup(true)
    const saved = storage.items.get('portal-lab')
    act(() => result.current.onboarding.start())

    expect(result.current.onboarding.offer).toBe(false)
    expect(result.current.onboarding.tour).not.toBeNull()
    expect(result.current.active).not.toBe(store)
    expect(result.current.active.getState().speed).toBe(0)
    expect(store.getState().speed).toBe(0)

    act(() => void result.current.active.dispatch({ type: 'openPortal' }))
    expect(result.current.portals).toBe(1)
    // Первый портал песочницы — подобранный seed
    expect(result.current.active.getState().lab.portals[0]?.name).toBe('ЗК-005-1')
    expect(store.getState().lab.portals).toHaveLength(0)
    expect(storage.items.get('portal-lab')).toBe(saved)
  })

  it('факты копят исходы команд песочницы', () => {
    const { result } = setup()
    act(() => result.current.onboarding.start())
    act(() => void result.current.active.dispatch({ type: 'openPortal' }))
    act(() => void result.current.active.dispatch({ type: 'recallObservers', portal: 'ЗК-005-1' }))
    expect([...(result.current.onboarding.tour?.facts ?? [])]).toEqual([
      'openPortal:ok',
      'recallObservers:refused',
    ])
  })

  it('выход возвращает настоящий store и его скорость, ставит флаг', () => {
    const { store, storage, result } = setup()
    act(() => result.current.onboarding.start())
    act(() => result.current.onboarding.exit())
    expect(result.current.active).toBe(store)
    expect(store.getState().speed).toBe(5)
    expect(result.current.onboarding.tour).toBeNull()
    expect(storage.items.get(ONBOARDING_KEY)).toBe('1')
  })

  it('повторный запуск начинает песочницу заново', () => {
    const { result } = setup()
    act(() => result.current.onboarding.start())
    act(() => void result.current.active.dispatch({ type: 'openPortal' }))
    act(() => result.current.onboarding.exit())
    act(() => result.current.onboarding.start())
    expect(result.current.active.getState().lab.portals).toHaveLength(0)
    expect(result.current.onboarding.tour?.facts.size).toBe(0)
  })
})
