import { beforeEach, describe, expect, it } from 'vitest'
import { createLab } from '../domain'
import { loadGame } from './persistence'
import { createLabStore, shallowEqual } from './store'

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)

function newStore(seed = 7) {
  return createLabStore({ storage: localStorage, seed, now: () => NOW })
}

describe('store лаборатории (spec §1, §5, §8)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('без сохранения начинает с пустой лаборатории и без отказа', () => {
    const store = newStore()

    expect(store.getState()).toEqual({ lab: createLab(), rejection: null })
  })

  it('успешная команда меняет лабораторию, уведомляет один раз и сохраняет игру', () => {
    const store = newStore()
    let notified = 0
    store.subscribe(() => notified++)

    store.dispatch({ type: 'openPortal' })

    const { lab } = store.getState()
    expect(lab.portals).toHaveLength(1)
    expect(lab.portals[0]?.status).toBe('open')
    expect(notified).toBe(1)
    expect(loadGame(localStorage)?.lab).toEqual(lab)
  })

  it('отказ попадает в состояние с растущим id и в журнал; успех его снимает', () => {
    const store = newStore()
    const stabilize = { type: 'stabilize', portal: 'XX-000-1' } as const

    const result = store.dispatch(stabilize)

    expect(result.rejection).toBe('Портал не открыт')
    expect(store.getState().rejection).toEqual({
      id: 1,
      command: stabilize,
      text: 'Портал не открыт',
    })
    expect(store.getState().lab.log.at(-1)?.kind).toBe('rejection')

    store.dispatch(stabilize)
    expect(store.getState().rejection?.id).toBe(2)

    store.dispatch({ type: 'openPortal' })
    expect(store.getState().rejection).toBeNull()
  })

  it('новый store над тем же хранилищем продолжает сохранённую лабораторию и ГСЧ', () => {
    const before = newStore()
    before.dispatch({ type: 'openPortal' })
    const reloaded = newStore(999)
    reloaded.dispatch({ type: 'openPortal' })

    localStorage.clear()
    const uninterrupted = newStore()
    uninterrupted.dispatch({ type: 'openPortal' })
    uninterrupted.dispatch({ type: 'openPortal' })

    expect(reloaded.getState().lab.portals).toHaveLength(2)
    expect(reloaded.getState().lab.portals).toEqual(uninterrupted.getState().lab.portals)
  })

  it('advance(3) — три тика, одно уведомление, игра сохранена', () => {
    const store = newStore()
    let notified = 0
    store.subscribe(() => notified++)

    store.advance(3)

    expect(store.getState().lab.time).toBe(3)
    expect(notified).toBe(1)
    expect(loadGame(localStorage)?.lab.time).toBe(3)
  })

  it('advance без аргумента — один тик', () => {
    const store = newStore()

    store.advance()

    expect(store.getState().lab.time).toBe(1)
  })

  it('advance(0) ничего не делает: ни уведомления, ни сохранения', () => {
    const store = newStore()
    let notified = 0
    store.subscribe(() => notified++)
    const state = store.getState()

    store.advance(0)

    expect(notified).toBe(0)
    expect(store.getState()).toBe(state)
    expect(loadGame(localStorage)).toBeNull()
  })

  it('advance сохраняет текущий отказ', () => {
    const store = newStore()
    store.dispatch({ type: 'stabilize', portal: 'XX-000-1' })
    const rejection = store.getState().rejection

    store.advance(1)

    expect(store.getState().rejection).toBe(rejection)
  })

  it('dismissRejection снимает отказ и уведомляет', () => {
    const store = newStore()
    store.dispatch({ type: 'stabilize', portal: 'XX-000-1' })
    let notified = 0
    store.subscribe(() => notified++)

    store.dismissRejection()

    expect(store.getState().rejection).toBeNull()
    expect(notified).toBe(1)
  })

  it('dismissRejection без отказа ничего не делает', () => {
    const store = newStore()
    let notified = 0
    store.subscribe(() => notified++)
    const state = store.getState()

    store.dismissRejection()

    expect(notified).toBe(0)
    expect(store.getState()).toBe(state)
  })

  it('после отписки уведомления не приходят', () => {
    const store = newStore()
    let notified = 0
    const unsubscribe = store.subscribe(() => notified++)

    unsubscribe()
    store.advance(1)

    expect(notified).toBe(0)
  })
})

describe('shallowEqual', () => {
  it('равны объекты с теми же значениями на первом уровне', () => {
    expect(shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true)
  })

  it('различаются при другом значении, другом наборе ключей или другом вложенном объекте', () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(shallowEqual<object>({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(shallowEqual<object>({ a: 1, b: undefined }, { a: 1, c: undefined })).toBe(false)
    expect(shallowEqual({ a: { n: 1 } }, { a: { n: 1 } })).toBe(false)
  })
})
