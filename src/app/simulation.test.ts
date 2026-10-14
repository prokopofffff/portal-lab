import { beforeEach, describe, expect, it } from 'vitest'
import { createLabStore, type LabStore, type Speed } from './store'
import { startSimulation, type SimulationEnv } from './simulation'

// Поддельные кадры, часы и видимость вкладки
function fakeEnv() {
  let time = 0
  let nextId = 1
  const frames = new Map<number, FrameRequestCallback>()
  const visibilityListeners = new Set<() => void>()
  const doc = {
    hidden: false,
    addEventListener: (_type: 'visibilitychange', listener: () => void) => {
      visibilityListeners.add(listener)
    },
    removeEventListener: (_type: 'visibilitychange', listener: () => void) => {
      visibilityListeners.delete(listener)
    },
  }
  const env: SimulationEnv = {
    requestAnimationFrame: (callback) => {
      frames.set(nextId, callback)
      return nextId++
    },
    cancelAnimationFrame: (id) => {
      frames.delete(id)
    },
    now: () => time,
    document: doc,
  }
  return {
    env,
    pendingFrames: () => frames.size,
    // Часы идут на ms, затем срабатывает ожидающий кадр
    frame(ms: number) {
      time += ms
      const [id, callback] = [...frames.entries()][0] ?? []
      if (id === undefined || callback === undefined) return
      frames.delete(id)
      callback(time)
    },
    // Часы идут на ms без кадров (вкладка спит)
    sleep(ms: number) {
      time += ms
    },
    setHidden(hidden: boolean) {
      doc.hidden = hidden
      for (const listener of [...visibilityListeners]) listener()
    },
    listenerCount: () => visibilityListeners.size,
  }
}

function newStore(speed: Speed = 1): LabStore {
  const store = createLabStore({ storage: localStorage, seed: 7, now: () => 0 })
  store.setSpeed(speed)
  return store
}

describe('цикл симуляции (spec §2.3, прил. B)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('×1: один тик на 1000 мс реального времени', () => {
    const store = newStore(1)
    const clock = fakeEnv()
    startSimulation(store, clock.env)

    clock.frame(400)
    expect(store.getState().lab.time).toBe(0)
    clock.frame(400)
    expect(store.getState().lab.time).toBe(0)
    clock.frame(400)
    expect(store.getState().lab.time).toBe(1)
  })

  it('дробный остаток переносится между кадрами', () => {
    const store = newStore(1)
    const clock = fakeEnv()
    startSimulation(store, clock.env)

    for (let i = 0; i < 10; i++) clock.frame(250)

    expect(store.getState().lab.time).toBe(2)
    clock.frame(500)
    expect(store.getState().lab.time).toBe(3)
  })

  it('×5 и ×20: несколько тиков за кадр одним уведомлением', () => {
    const store = newStore(5)
    const clock = fakeEnv()
    startSimulation(store, clock.env)
    let notified = 0
    store.subscribe(() => notified++)

    clock.frame(1000)
    expect(store.getState().lab.time).toBe(5)
    expect(notified).toBe(1)

    store.setSpeed(20)
    notified = 0
    clock.frame(500)
    expect(store.getState().lab.time).toBe(15)
    expect(notified).toBe(1)
  })

  it('пауза: тиков нет, остаток сброшен', () => {
    const store = newStore(1)
    const clock = fakeEnv()
    startSimulation(store, clock.env)
    clock.frame(900)

    store.setSpeed(0)
    clock.frame(5000)
    expect(store.getState().lab.time).toBe(0)

    store.setSpeed(1)
    clock.frame(200)
    expect(store.getState().lab.time).toBe(0)
    clock.frame(800)
    expect(store.getState().lab.time).toBe(1)
  })

  it('вкладка скрыта: тиков нет, после возврата время простоя не догоняется', () => {
    const store = newStore(1)
    const clock = fakeEnv()
    startSimulation(store, clock.env)
    clock.frame(700)

    clock.setHidden(true)
    clock.frame(1000)
    clock.sleep(60_000)
    expect(store.getState().lab.time).toBe(0)

    clock.setHidden(false)
    clock.frame(300)
    expect(store.getState().lab.time).toBe(0)
    clock.frame(700)
    expect(store.getState().lab.time).toBe(1)
  })

  it('скрытие вкладки не меняет выбранную скорость', () => {
    const store = newStore(5)
    const clock = fakeEnv()
    startSimulation(store, clock.env)

    clock.setHidden(true)
    clock.setHidden(false)
    clock.frame(1000)

    expect(store.getState().speed).toBe(5)
    expect(store.getState().lab.time).toBe(5)
  })

  it('долгий разрыв между кадрами урезается до 1000 мс', () => {
    const store = newStore(1)
    const clock = fakeEnv()
    startSimulation(store, clock.env)

    clock.frame(30_000)

    expect(store.getState().lab.time).toBe(1)
  })

  it('stop отменяет кадр и снимает подписку на видимость', () => {
    const store = newStore(1)
    const clock = fakeEnv()
    const stop = startSimulation(store, clock.env)
    expect(clock.pendingFrames()).toBe(1)
    expect(clock.listenerCount()).toBe(1)

    stop()

    expect(clock.pendingFrames()).toBe(0)
    expect(clock.listenerCount()).toBe(0)
    clock.frame(2000)
    expect(store.getState().lab.time).toBe(0)
  })

  it('stop из подписчика во время advance: новый кадр не запрашивается', () => {
    const store = newStore(1)
    const clock = fakeEnv()
    const stop = startSimulation(store, clock.env)
    store.subscribe(() => stop())

    clock.frame(1000)

    expect(store.getState().lab.time).toBe(1)
    expect(clock.pendingFrames()).toBe(0)
    clock.frame(1000)
    expect(store.getState().lab.time).toBe(1)
  })

  it('advance бросает исключение: следующий кадр всё равно запрошен', () => {
    const store = newStore(1)
    const clock = fakeEnv()
    startSimulation(store, clock.env)
    const advance = store.advance
    let calls = 0
    store.advance = (ticks) => {
      if (calls++ === 0) throw new Error('сбой тика')
      advance(ticks)
    }

    expect(() => clock.frame(1000)).toThrow('сбой тика')
    expect(clock.pendingFrames()).toBe(1)
    clock.frame(1000)
    expect(store.getState().lab.time).toBe(1)
  })
})
