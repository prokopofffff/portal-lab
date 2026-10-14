import { describe, expect, it } from 'vitest'
import { observersNoun } from './plural'

describe('observersNoun: склонение «наблюдатель» по числу', () => {
  it.each([
    [1, 'наблюдатель'],
    [2, 'наблюдателя'],
    [3, 'наблюдателя'],
    [5, 'наблюдателей'],
    [11, 'наблюдателей'],
    [12, 'наблюдателей'],
    [14, 'наблюдателей'],
    [21, 'наблюдатель'],
    [22, 'наблюдателя'],
    [25, 'наблюдателей'],
  ])('%i → «%s»', (n, noun) => {
    expect(observersNoun(n)).toBe(noun)
  })
})
