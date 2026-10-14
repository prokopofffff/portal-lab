// Параметры запуска и тестовый режим `?seed=&test=1` (docs/spec.md §1, §10).
import type { LabStore } from './store'

export interface Launch {
  seed: number | null
  test: boolean
}

// Хук для E2E: доступен только при test=1
export interface LabTestHook {
  advance(ticks: number): void
}

declare global {
  interface Window {
    __lab?: LabTestHook
  }
}

const MAX_SEED = 2 ** 32 - 1

// Разбирает query-строку: seed — целое из [0, 2^32 − 1], test — ровно «1»
export function parseLaunch(search: string): Launch {
  const params = new URLSearchParams(search)
  const rawSeed = params.get('seed')
  const seed = rawSeed !== null && /^\d+$/.test(rawSeed) ? Number(rawSeed) : null
  return {
    seed: seed !== null && seed <= MAX_SEED ? seed : null,
    test: params.get('test') === '1',
  }
}

// Ставит паузу, чтобы реальные тики не мешались с advance(n), и вешает хук на target
export function installTestMode(store: LabStore, target: { __lab?: LabTestHook }): void {
  store.setSpeed(0)
  target.__lab = {
    advance(ticks) {
      if (!Number.isSafeInteger(ticks) || ticks < 0) {
        throw new RangeError('Число тиков должно быть неотрицательным целым')
      }
      store.advance(ticks)
    },
  }
}
