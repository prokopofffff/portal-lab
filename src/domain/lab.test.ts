import { describe, expect, it } from 'vitest'
import { createLab } from './lab'

describe('createLab (spec §2.3)', () => {
  it('пустая лаборатория: время 0, нет порталов, миров и журнала', () => {
    const lab = createLab()
    expect(lab.time).toBe(0)
    expect(lab.portals).toEqual([])
    expect(lab.worlds).toEqual({})
    expect(lab.log).toEqual([])
  })

  it('штат на старте — 3 свободных наблюдателя, найма нет, потерь нет', () => {
    const { staff } = createLab()
    expect(staff).toEqual({ free: 3, hireTicksLeft: 0, lost: 0 })
  })
})
