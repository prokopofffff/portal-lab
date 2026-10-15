// Внешний store лаборатории для React (docs/spec.md §1, §5, §8): домен + ГСЧ + автосохранение.
import {
  advance as advanceLab,
  createLab,
  CONFIG,
  createRng,
  dispatch as dispatchCommand,
  type Command,
  type DispatchResult,
  type Lab,
} from '../domain'
import { MAX_NOTIFICATIONS, notificationsFromTick, type Notification } from './notifications'
import { loadGame, saveGame } from './persistence'

// Скорость симуляции: 0 — пауза, иначе тиков в секунду (spec §2.3)
export type Speed = (typeof CONFIG.speeds)[number]
export const SPEEDS: readonly Speed[] = CONFIG.speeds

export interface LabState {
  lab: Lab
  // Очередь баннеров, старые первыми; не сохраняется, как и speed
  notifications: Notification[]
  // Не сохраняется: после загрузки игра идёт на ×1
  speed: Speed
}

export interface LabStore {
  getState(): LabState
  subscribe(listener: () => void): () => void
  dispatch(command: Command): DispatchResult
  advance(ticks?: number): void
  dismissNotification(id: number): void
  setSpeed(speed: Speed): void
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
  let state: LabState = { lab: save ? save.lab : createLab(), notifications: [], speed: 1 }
  const listeners = new Set<() => void>()
  let lastNotificationId = 0

  function notify(): void {
    for (const listener of listeners) listener()
  }

  // Дописывает уведомления с новыми id; в очереди остаются MAX_NOTIFICATIONS новейших.
  // Нечего добавлять — прежний массив (ссылка нужна селекторам useSyncExternalStore)
  function enqueue(queue: Notification[], fresh: Omit<Notification, 'id'>[]): Notification[] {
    if (fresh.length === 0) return queue
    const added = fresh.map((item) => ({ ...item, id: ++lastNotificationId }))
    return [...queue, ...added].slice(-MAX_NOTIFICATIONS)
  }

  // Новое состояние: автосохранение и уведомление подписчиков
  function commit(next: LabState): void {
    state = next
    saveGame(storage, { lab: state.lab, rngState: rng.state() })
    notify()
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
      // Запечатанная лаборатория начинается с чистой очереди; успех команды очередь не трогает
      const queue = command.type === 'sealLab' ? [] : state.notifications
      const refusal =
        result.rejection === undefined ? [] : [{ kind: 'refuse' as const, text: result.rejection }]
      commit({ ...state, lab: result.lab, notifications: enqueue(queue, refusal) })
      return result
    },
    advance(ticks = 1) {
      if (ticks <= 0) return
      let { lab } = state
      const fresh: Omit<Notification, 'id'>[] = []
      for (let i = 0; i < ticks; i++) {
        const result = advanceLab(lab, now())
        lab = result.lab
        fresh.push(...notificationsFromTick(result.events))
      }
      commit({ ...state, lab, notifications: enqueue(state.notifications, fresh) })
    },
    dismissNotification(id) {
      if (!state.notifications.some((n) => n.id === id)) return
      commit({ ...state, notifications: state.notifications.filter((n) => n.id !== id) })
    },
    // Скорость вне сохранения: только уведомление, без записи в хранилище
    setSpeed(speed) {
      if (state.speed === speed) return
      state = { ...state, speed }
      notify()
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
