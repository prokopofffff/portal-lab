// Детерминированный ГСЧ mulberry32: состояние — одно uint32.
// Домен получает Rng снаружи; Math.random в домене запрещён линтером.

export interface Rng {
  /** вещественное число из [0, 1) */
  next(): number
  /** целое из [min, max], обе границы включительно */
  int(min: number, max: number): number
  /** случайный элемент списка; на пустом списке бросает RangeError */
  pick<T>(list: readonly T[]): T
  /** текущее состояние: createRng(rng.state()) продолжит ту же последовательность */
  state(): number
}

const UINT32_MAX = 4294967295

// seed — uint32: |0 молча свёл бы NaN, дробь или переполнение к чужой последовательности
export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new RangeError(`createRng: seed должен быть uint32 (получено ${seed})`)
  }
  let a = seed | 0

  function next(): number {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new RangeError(`int: границы должны быть целыми (получено ${min}, ${max})`)
    }
    if (min > max) {
      throw new RangeError(`int: min больше max (${min} > ${max})`)
    }
    return min + Math.floor(next() * (max - min + 1))
  }

  function pick<T>(list: readonly T[]): T {
    if (list.length === 0) {
      throw new RangeError('pick: список пуст')
    }
    return list[int(0, list.length - 1)] as T
  }

  return { next, int, pick, state: () => a >>> 0 }
}
