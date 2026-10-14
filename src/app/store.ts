// Внешний store лаборатории для React (docs/spec.md §1, §5, §8): домен + ГСЧ + автосохранение.
import {
  advance as advanceLab,
  createLab,
  createRng,
  dispatch as dispatchCommand,
  type Command,
  type DispatchResult,
  type Lab,
} from '../domain'
import { loadGame, saveGame } from './persistence'

// Последний отказ команды; id растёт, чтобы UI заново показал тот же текст
export interface Rejection {
  id: number
  command: Command
  text: string
}

export interface LabState {
  lab: Lab
  rejection: Rejection | null
}

export interface LabStore {
  getState(): LabState
  subscribe(listener: () => void): () => void
  dispatch(command: Command): DispatchResult
  advance(ticks?: number): void
  dismissRejection(): void
}

// Поднимает игру из сохранения или начинает новую с seed (spec §1)
export function createLabStore(options: {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  seed: number
  now: () => number
}): LabStore {
  const { storage, now } = options
  const save = loadGame(storage)
  const rng = createRng(save ? save.rngState : options.seed)
  let state: LabState = { lab: save ? save.lab : createLab(), rejection: null }
  const listeners = new Set<() => void>()
  let lastRejectionId = 0

  // Новое состояние: автосохранение и уведомление подписчиков
  function commit(next: LabState): void {
    state = next
    saveGame(storage, { lab: state.lab, rngState: rng.state() })
    for (const listener of listeners) listener()
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispatch(command) {
      const result = dispatchCommand(state.lab, command, rng, now())
      const rejection =
        result.rejection === undefined
          ? null
          : { id: ++lastRejectionId, command, text: result.rejection }
      commit({ lab: result.lab, rejection })
      return result
    },
    advance(ticks = 1) {
      if (ticks <= 0) return
      let { lab } = state
      for (let i = 0; i < ticks; i++) lab = advanceLab(lab, now()).lab
      commit({ ...state, lab })
    },
    dismissRejection() {
      if (state.rejection === null) return
      commit({ ...state, rejection: null })
    },
  }
}

// Равенство объектов на один уровень вглубь: для производных срезов в useLabSelector
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const keysA = Object.keys(a)
  if (keysA.length !== Object.keys(b).length) return false
  return keysA.every(
    (key) =>
      Object.hasOwn(b, key) &&
      Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}
