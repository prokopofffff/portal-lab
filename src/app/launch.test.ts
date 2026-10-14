import { beforeEach, describe, expect, it } from 'vitest'
import { installTestMode, parseLaunch, type LabTestHook } from './launch'
import { createLabStore } from './store'

describe('parseLaunch (spec §1, §10)', () => {
  it('берёт seed — десятичное целое из диапазона uint32', () => {
    expect(parseLaunch('?seed=42').seed).toBe(42)
    expect(parseLaunch('?seed=0').seed).toBe(0)
    expect(parseLaunch('?seed=4294967295').seed).toBe(4294967295)
  })

  it.each(['', '?test=1', '?seed=', '?seed=abc', '?seed=-1', '?seed=1.5', '?seed=4294967296'])(
    'некорректный или отсутствующий seed даёт null: %j',
    (search) => {
      expect(parseLaunch(search).seed).toBeNull()
    },
  )

  it('test включается только значением 1', () => {
    expect(parseLaunch('?seed=1&test=1').test).toBe(true)
    expect(parseLaunch('?test=0').test).toBe(false)
    expect(parseLaunch('?test=true').test).toBe(false)
    expect(parseLaunch('?seed=1').test).toBe(false)
  })
})

describe('installTestMode', () => {
  const storage = { getItem: () => null, setItem: () => undefined }
  let store: ReturnType<typeof createLabStore>
  let target: { __lab?: LabTestHook }

  beforeEach(() => {
    store = createLabStore({ storage, seed: 1, now: () => 0 })
    target = {}
    installTestMode(store, target)
  })

  it('ставит паузу и вешает хук на target', () => {
    expect(store.getState().speed).toBe(0)
    expect(target.__lab).toBeDefined()
  })

  it('advance(n) двигает время лаборатории на n тиков', () => {
    target.__lab!.advance(5)

    expect(store.getState().lab.time).toBe(5)
  })

  it.each([-1, 1.5, NaN])('advance(%s) бросает RangeError и не меняет состояние', (n) => {
    const before = store.getState()

    expect(() => target.__lab!.advance(n)).toThrow(RangeError)
    expect(store.getState()).toBe(before)
  })
})
