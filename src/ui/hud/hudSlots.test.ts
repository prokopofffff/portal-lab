import { describe, expect, it } from 'vitest'
import { createLab, summarize, type Summary } from '../../domain'
import { hireProgress, hudStats, observerSlots } from './hudSlots'

const staff = (free: number, onSite: number, inTransit: number) => ({
  free,
  onSite,
  inTransit,
  lost: 0,
})

describe('observerSlots', () => {
  it('порядок: свободные, на месте, в пути', () => {
    expect(observerSlots(staff(1, 3, 1))).toEqual(['free', 'onsite', 'onsite', 'onsite', 'transit'])
  })

  it('новая лаборатория: трое свободных и два пустых слота', () => {
    expect(observerSlots(summarize(createLab()).staff)).toEqual([
      'free',
      'free',
      'free',
      'empty',
      'empty',
    ])
  })

  it('никого нет: пять пустых слотов', () => {
    expect(observerSlots(staff(0, 0, 0))).toEqual(['empty', 'empty', 'empty', 'empty', 'empty'])
  })

  it('на месте и в пути без свободных', () => {
    expect(observerSlots(staff(0, 2, 1))).toEqual(['onsite', 'onsite', 'transit', 'empty', 'empty'])
  })
})

describe('hireProgress', () => {
  it('доля пройденного найма из 20 тиков', () => {
    expect(hireProgress(20)).toBe(0)
    expect(hireProgress(8)).toBeCloseTo(0.6)
    expect(hireProgress(1)).toBeCloseTo(0.95)
  })
})

describe('hudStats', () => {
  const summary: Summary = {
    open: 5,
    maxOpen: 12,
    critical: 1,
    closed: 2,
    collapsed: 1,
    worlds: 6,
    studied: 17,
    creatures: 41,
    staff: staff(1, 3, 1),
  }

  it('шесть счётчиков в порядке канваса', () => {
    expect(hudStats(summary).map(({ label, value }) => [label, value])).toEqual([
      ['ОТКРЫТО', '5 / 12'],
      ['КРИТИЧЕСКИХ', '1'],
      ['ЗАКРЫТО', '2'],
      ['СХЛОПНУЛОСЬ', '1'],
      ['МИРОВ', '6'],
      ['ИЗУЧЕНО СУЩЕСТВ', '17 / 41'],
    ])
  })

  it('тревога: критические > 0; открыто ниже предела — без тревоги', () => {
    expect(hudStats(summary).map((s) => s.alert)).toEqual([
      null,
      'critical',
      null,
      null,
      null,
      null,
    ])
  })

  it('открыто на пределе — тревога high; без критических — без тревоги', () => {
    const alerts = hudStats({ ...summary, open: 12, critical: 0 }).map((s) => s.alert)
    expect(alerts.slice(0, 2)).toEqual(['high', null])
  })
})
