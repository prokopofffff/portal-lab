import { beforeEach, describe, expect, it } from 'vitest'
import { assessRisk, createLab } from '../domain'
import { labWith, portal, storeWithLab, world } from '../test/labFixtures'
import { MAX_NOTIFICATIONS } from './notifications'
import { loadGame, STORAGE_KEY } from './persistence'
import { createLabStore, shallowEqual, SPEEDS } from './store'

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)

function newStore(seed = 7) {
  return createLabStore({ storage: localStorage, seed, now: () => NOW })
}

describe('store лаборатории (spec §1, §5, §8)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('без сохранения начинает с пустой лаборатории и без уведомлений', () => {
    const store = newStore()

    expect(store.getState()).toEqual({ lab: createLab(), notifications: [], speed: 1 })
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

  it('отказ попадает в очередь уведомлений с растущим id и в журнал; успех очередь не трогает', () => {
    const store = newStore()
    const stabilize = { type: 'stabilize', portal: 'XX-000-1' } as const

    const result = store.dispatch(stabilize)

    expect(result.rejection).toBe('Портал не открыт')
    expect(store.getState().notifications).toEqual([
      { id: 1, kind: 'refuse', text: 'Портал не открыт' },
    ])
    expect(store.getState().lab.log.at(-1)?.kind).toBe('rejection')

    store.dispatch(stabilize)
    expect(store.getState().notifications.map((n) => n.id)).toEqual([1, 2])

    store.dispatch({ type: 'openPortal' })
    expect(store.getState().notifications.map((n) => n.id)).toEqual([1, 2])
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

  it('SPEEDS — пауза, ×1, ×5, ×20 (spec §2.3)', () => {
    expect(SPEEDS).toEqual([0, 1, 5, 20])
  })

  it('setSpeed меняет скорость и уведомляет; та же скорость — без уведомления', () => {
    const store = newStore()
    let notified = 0
    store.subscribe(() => notified++)

    store.setSpeed(5)
    expect(store.getState().speed).toBe(5)
    expect(notified).toBe(1)

    const state = store.getState()
    store.setSpeed(5)
    expect(store.getState()).toBe(state)
    expect(notified).toBe(1)

    store.setSpeed(0)
    expect(store.getState().speed).toBe(0)
    expect(notified).toBe(2)
  })

  it('скорость не сохраняется: новая игра над тем же хранилищем идёт на ×1', () => {
    const before = newStore()
    before.setSpeed(20)
    before.advance(1)

    expect(newStore().getState().speed).toBe(1)
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('speed')
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

  it('advance сохраняет очередь, если событий для уведомлений нет: ссылка прежняя', () => {
    const store = newStore()
    store.dispatch({ type: 'stabilize', portal: 'XX-000-1' })
    const { notifications } = store.getState()

    store.advance(1)

    expect(store.getState().notifications).toBe(notifications)
  })

  it('dismissNotification убирает одно уведомление и уведомляет', () => {
    const store = newStore()
    store.dispatch({ type: 'stabilize', portal: 'XX-000-1' })
    store.dispatch({ type: 'stabilize', portal: 'XX-000-1' })
    let notified = 0
    store.subscribe(() => notified++)

    store.dismissNotification(1)

    expect(store.getState().notifications.map((n) => n.id)).toEqual([2])
    expect(notified).toBe(1)
  })

  it('dismissNotification с неизвестным id ничего не делает', () => {
    const store = newStore()
    store.dispatch({ type: 'stabilize', portal: 'XX-000-1' })
    let notified = 0
    store.subscribe(() => notified++)
    const state = store.getState()

    store.dismissNotification(99)

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

describe('очередь уведомлений в store', () => {
  const REFUSAL = { type: 'stabilize', portal: 'XX-000-1' } as const
  // Наём завершается на следующем тике → событие hireCompleted
  const hiring = () =>
    storeWithLab(labWith({ worlds: {}, staff: { free: 0, hireTicksLeft: 1, lost: 0 } }))

  beforeEach(() => {
    localStorage.clear()
  })

  it('advance кладёт уведомления событий тика в очередь', () => {
    const store = hiring()

    store.advance(1)

    expect(store.getState().notifications).toEqual([
      { id: 1, kind: 'hired', text: 'Новый наблюдатель прибыл в лабораторию и свободен' },
    ])
  })

  it('id общий для отказов и тиков и растёт без разрывов', () => {
    const store = hiring()

    store.dispatch(REFUSAL)
    store.advance(1)
    store.dispatch(REFUSAL)

    expect(store.getState().notifications.map((n) => [n.id, n.kind])).toEqual([
      [1, 'refuse'],
      [2, 'hired'],
      [3, 'refuse'],
    ])
  })

  it('advance собирает события каждого тика, по порядку тиков', () => {
    const store = storeWithLab(
      labWith({
        worlds: { Сад: world('Сад', 'ЯС-100') },
        portals: [portal('ЯС-100-1', 'Сад', { timeLeft: 1, observers: 2 })],
        staff: { free: 0, hireTicksLeft: 2, lost: 0 },
      }),
    )

    store.advance(2)

    const kinds = store.getState().notifications.map((n) => n.kind)
    expect(kinds).toContain('collapse')
    expect(kinds).toContain('lost')
    expect(kinds.at(-1)).toBe('hired')
    const ids = store.getState().notifications.map((n) => n.id)
    expect(ids).toEqual(ids.map((_, i) => i + 1))
  })

  it('в очереди не больше MAX_NOTIFICATIONS новейших', () => {
    const store = newStore()

    for (let i = 0; i < MAX_NOTIFICATIONS + 2; i++) store.dispatch(REFUSAL)

    expect(store.getState().notifications.map((n) => n.id)).toEqual([3, 4, 5, 6, 7])
  })

  it('тик без уведомлений не создаёт новый массив и не меняет id', () => {
    const store = newStore()
    store.dispatch(REFUSAL)
    const before = store.getState().notifications

    store.advance(3)
    expect(store.getState().notifications).toBe(before)

    store.dispatch(REFUSAL)
    expect(store.getState().notifications.at(-1)?.id).toBe(2)
  })

  it('успешная команда очередь не очищает', () => {
    const store = newStore()
    store.dispatch(REFUSAL)

    store.dispatch({ type: 'openPortal' })

    expect(store.getState().notifications).toHaveLength(1)
  })

  it('запечатывание лаборатории очищает очередь', () => {
    const store = newStore()
    store.dispatch(REFUSAL)

    store.dispatch({ type: 'sealLab' })

    expect(store.getState().notifications).toEqual([])
  })

  it('уведомления не сохраняются: новая игра над тем же хранилищем начинает с пустой очереди', () => {
    const store = newStore()
    store.dispatch(REFUSAL)

    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('notifications')
    expect(newStore().getState().notifications).toEqual([])
  })
})

describe('воспроизводимость по seed (spec §1, §10)', () => {
  // Пара seed/N для e2e: на 50-м тике первый портал уже критический, но ещё открыт
  const CRITICAL_SEED = 3
  const CRITICAL_TICKS = 50

  function freshStore(seed: number) {
    localStorage.clear()
    return createLabStore({ storage: localStorage, seed, now: () => NOW })
  }

  function playFrom(seed: number, ticks: number) {
    const store = freshStore(seed)
    store.dispatch({ type: 'openPortal' })
    store.advance(ticks)
    return store.getState().lab
  }

  it('тот же seed и те же команды дают одинаковую лабораторию', () => {
    expect(playFrom(CRITICAL_SEED, CRITICAL_TICKS)).toEqual(playFrom(CRITICAL_SEED, CRITICAL_TICKS))
  })

  it('фиксированный seed и N тиков дают открытый критический портал', () => {
    const portal = playFrom(CRITICAL_SEED, CRITICAL_TICKS).portals[0]

    expect(portal?.status).toBe('open')
    expect(portal && assessRisk(portal).level).toBe('critical')
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
