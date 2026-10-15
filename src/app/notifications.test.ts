import { describe, expect, it } from 'vitest'
import type { TickEvent } from '../domain'
import { MAX_NOTIFICATIONS, notificationsFromTick } from './notifications'

describe('notificationsFromTick: события тика в уведомления', () => {
  it('portalCollapsed — collapse', () => {
    const events: TickEvent[] = [
      { type: 'portalCollapsed', portal: 'ЗМ-517-1', world: 'Змеиный Мох', cause: 'time' },
    ]

    expect(notificationsFromTick(events)).toEqual([
      { kind: 'collapse', text: 'ЗМ-517-1 (Змеиный Мох) сжался и погас' },
    ])
  })

  it.each([
    [1, 'Потерян 1 наблюдатель при схлопывании ЗМ-517-1'],
    [2, 'Потеряно 2 наблюдателя при схлопывании ЗМ-517-1'],
    [5, 'Потеряно 5 наблюдателей при схлопывании ЗМ-517-1'],
    [11, 'Потеряно 11 наблюдателей при схлопывании ЗМ-517-1'],
    [21, 'Потерян 21 наблюдатель при схлопывании ЗМ-517-1'],
  ])('observersLost при %i — lost с согласованным глаголом', (count, text) => {
    const events: TickEvent[] = [
      { type: 'observersLost', portal: 'ЗМ-517-1', world: 'Змеиный Мох', count },
    ]

    expect(notificationsFromTick(events)).toEqual([{ kind: 'lost', text }])
  })

  it.each([
    [1, 'Мир Пепельные Пустоши изучен полностью — 1 из 1 существо'],
    [2, 'Мир Пепельные Пустоши изучен полностью — 2 из 2 существа'],
    [5, 'Мир Пепельные Пустоши изучен полностью — 5 из 5 существ'],
    [11, 'Мир Пепельные Пустоши изучен полностью — 11 из 11 существ'],
    [21, 'Мир Пепельные Пустоши изучен полностью — 21 из 21 существо'],
  ])(
    'worldStudied при %i существах — studied с «Мир» впереди и согласованным существительным',
    (creatures, text) => {
      const events: TickEvent[] = [
        { type: 'worldStudied', world: 'Пепельные Пустоши', creatures, returned: 1 },
      ]

      expect(notificationsFromTick(events)).toEqual([{ kind: 'studied', text }])
    },
  )

  it('hireCompleted — hired', () => {
    expect(notificationsFromTick([{ type: 'hireCompleted' }])).toEqual([
      { kind: 'hired', text: 'Новый наблюдатель прибыл в лабораторию и свободен' },
    ])
  })

  it('остальные события уведомлений не дают', () => {
    const events: TickEvent[] = [
      {
        type: 'creatureStudied',
        portal: 'ЗМ-517-1',
        world: 'Змеиный Мох',
        studied: 1,
        creatures: 7,
      },
      {
        type: 'acceptanceRevoked',
        portal: 'ЗМ-517-1',
        world: 'Змеиный Мох',
        acceptedAt: 'low',
        level: 'high',
      },
    ]

    expect(notificationsFromTick(events)).toEqual([])
    expect(notificationsFromTick([])).toEqual([])
  })

  it('порядок событий сохраняется', () => {
    const events: TickEvent[] = [
      { type: 'hireCompleted' },
      { type: 'portalCollapsed', portal: 'ЗМ-517-1', world: 'Змеиный Мох', cause: 'stability' },
      { type: 'observersLost', portal: 'ЗМ-517-1', world: 'Змеиный Мох', count: 2 },
    ]

    expect(notificationsFromTick(events).map((n) => n.kind)).toEqual(['hired', 'collapse', 'lost'])
  })

  it('MAX_NOTIFICATIONS — пять (канвас 16-banners)', () => {
    expect(MAX_NOTIFICATIONS).toBe(5)
  })
})
