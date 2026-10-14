import { describe, expect, it } from 'vitest'
import { createLab, type Lab, type Portal } from './lab'
import { tick } from './tick'

// Открытый портал без наблюдателей; переопределения задают нужную метрику
function portal(overrides: Partial<Portal> = {}): Portal {
  return {
    name: 'ПШ-449-1',
    world: 'Пепельный Шпиль',
    status: 'open',
    arch: 0,
    energy: 80,
    stability: 50,
    timeLeft: 100,
    observers: 0,
    studyProgress: 0,
    cooldown: 0,
    questioned: null,
    acceptedAt: null,
    ...overrides,
  }
}

// Лаборатория с порталами и миром «Пепельный Шпиль»
function labWith(portals: Portal[], overrides: Partial<Lab> = {}): Lab {
  return {
    ...createLab(),
    portals,
    worlds: {
      'Пепельный Шпиль': {
        name: 'Пепельный Шпиль',
        code: 'ПШ-449',
        creatures: 4,
        studied: 1,
        visits: 1,
      },
    },
    ...overrides,
  }
}

// Весь штат: свободные, на порталах и идущий наём (spec §2.3)
function staffTotal(lab: Lab): number {
  const onSite = lab.portals.reduce((sum, p) => sum + p.observers, 0)
  return lab.staff.free + onSite + (lab.staff.hireTicksLeft > 0 ? 1 : 0)
}

describe('tick: время (spec §4)', () => {
  it('прибавляет тик ко времени, не трогает журнал и не меняет исходную лабораторию', () => {
    const entry = {
      time: 3,
      realTime: 1000,
      portal: null,
      world: null,
      kind: 'system' as const,
      text: 'Запись',
    }
    const lab = labWith([portal()], { time: 7, log: [entry] })
    const snapshot = structuredClone(lab)

    const result = tick(lab)

    expect(result.lab.time).toBe(8)
    expect(result.lab.log).toEqual([entry])
    expect(lab).toEqual(snapshot)
  })
})

describe('tick: деградация портала (spec §4, шаг 3)', () => {
  it('без наблюдателей: стабильность падает на энергия/200, время и перезарядка — на 1', () => {
    const lab = labWith([portal({ energy: 80, stability: 50, timeLeft: 100, cooldown: 5 })])

    const [p] = tick(lab).lab.portals

    expect(p).toMatchObject({ stability: 49.6, timeLeft: 99, cooldown: 4 })
  })

  it('с наблюдателем на месте стабильность падает вдвое медленнее', () => {
    const lab = labWith([portal({ energy: 80, stability: 50, observers: 1 })])

    const [p] = tick(lab).lab.portals

    expect(p!.stability).toBe(49.8)
  })

  it('перезарядка не уходит ниже нуля, а метрики закрытого портала не меняются', () => {
    const closed = portal({
      name: 'ПШ-449-2',
      status: 'closed',
      arch: 1,
      stability: 50,
      timeLeft: 100,
      cooldown: 5,
    })
    const lab = labWith([portal({ cooldown: 0 }), closed])

    const [open, still] = tick(lab).lab.portals

    expect(open!.cooldown).toBe(0)
    expect(still).toEqual(closed)
  })
})

describe('tick: обрушение портала (spec §4, шаг 4)', () => {
  it('по времени: при timeLeft 1 портал обрушивается, причина — time', () => {
    const lab = labWith([portal({ timeLeft: 1 })])

    const result = tick(lab)

    expect(result.lab.portals[0]).toMatchObject({ status: 'collapsed', timeLeft: 0 })
    expect(result.events).toEqual([
      { type: 'portalCollapsed', portal: 'ПШ-449-1', world: 'Пепельный Шпиль', cause: 'time' },
    ])
  })

  it('по стабильности: при энергии 100 и стабильности 0.5 портал обрушивается, причина — stability', () => {
    const lab = labWith([portal({ energy: 100, stability: 0.5, timeLeft: 100 })])

    const result = tick(lab)

    expect(result.lab.portals[0]).toMatchObject({ status: 'collapsed', stability: 0 })
    expect(result.events).toEqual([
      {
        type: 'portalCollapsed',
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        cause: 'stability',
      },
    ])
  })

  it('с двумя наблюдателями на месте: они теряются, штат уменьшается на 2, мир не меняется', () => {
    const lab = labWith(
      [
        portal({
          timeLeft: 1,
          observers: 2,
          studyProgress: 7,
          questioned: { note: 'Проверить' },
          acceptedAt: 'high',
        }),
      ],
      { staff: { free: 1, hireTicksLeft: 5, lost: 0 } },
    )

    const result = tick(lab)

    expect(result.lab.staff).toEqual({ free: 1, hireTicksLeft: 4, lost: 2 })
    expect(result.lab.portals[0]).toMatchObject({
      status: 'collapsed',
      observers: 0,
      studyProgress: 0,
      questioned: null,
      acceptedAt: null,
      energy: 80,
    })
    expect(result.lab.worlds['Пепельный Шпиль']).toEqual(lab.worlds['Пепельный Шпиль'])
    expect(result.events).toEqual([
      { type: 'portalCollapsed', portal: 'ПШ-449-1', world: 'Пепельный Шпиль', cause: 'time' },
      { type: 'observersLost', portal: 'ПШ-449-1', world: 'Пепельный Шпиль', count: 2 },
    ])
    // Штат: свободные + на месте + идущий наём — до 1 + 2 + 1, после 1 + 0 + 1; найм продолжается
    expect(staffTotal(result.lab)).toBe(staffTotal(lab) - 2)
  })
})

describe('tick: наём (spec §4, шаг 1)', () => {
  it('за два тика наём завершается: свободных +1, событие hireCompleted только на втором', () => {
    const lab = labWith([], { staff: { free: 2, hireTicksLeft: 2, lost: 0 } })

    const first = tick(lab)
    expect(first.lab.staff).toEqual({ free: 2, hireTicksLeft: 1, lost: 0 })
    expect(first.events).toEqual([])

    const second = tick(first.lab)
    expect(second.lab.staff).toEqual({ free: 3, hireTicksLeft: 0, lost: 0 })
    expect(second.events).toEqual([{ type: 'hireCompleted' }])
  })

  it('без идущего найма штат не меняется', () => {
    const lab = labWith([], { staff: { free: 2, hireTicksLeft: 0, lost: 0 } })

    const result = tick(lab)

    expect(result.lab.staff).toEqual({ free: 2, hireTicksLeft: 0, lost: 0 })
    expect(result.events).toEqual([])
  })
})

describe('tick: изучение мира (spec §4, шаг 2)', () => {
  it('один наблюдатель: за 19 тиков существо не изучено, на 20-м изучено, прогресс сброшен', () => {
    let lab = labWith([portal({ observers: 1, stability: 100, timeLeft: 100 })])

    for (let i = 0; i < 19; i++) lab = tick(lab).lab
    expect(lab.worlds['Пепельный Шпиль']!.studied).toBe(1)
    expect(lab.portals[0]!.studyProgress).toBe(19)

    const result = tick(lab)

    expect(result.lab.worlds['Пепельный Шпиль']!.studied).toBe(2)
    expect(result.lab.portals[0]!.studyProgress).toBe(0)
    expect(result.events).toEqual([
      {
        type: 'creatureStudied',
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        studied: 2,
        creatures: 4,
      },
    ])
  })

  it('три наблюдателя: прогресс растёт на 3 за тик, на 18 + 3 существо изучено, остаток 1', () => {
    const lab = labWith([portal({ observers: 3, stability: 100 })])

    const first = tick(lab)
    expect(first.lab.portals[0]!.studyProgress).toBe(3)
    expect(first.events).toEqual([])

    const second = tick(labWith([portal({ observers: 3, stability: 100, studyProgress: 18 })]))
    expect(second.lab.worlds['Пепельный Шпиль']!.studied).toBe(2)
    expect(second.lab.portals[0]!.studyProgress).toBe(1)
    expect(second.events).toHaveLength(1)
  })

  it('два открытых портала одного мира складываются в общий счётчик изученных', () => {
    const lab = labWith([
      portal({ name: 'ПШ-449-1', observers: 1, studyProgress: 19, stability: 100 }),
      portal({ name: 'ПШ-449-2', observers: 1, studyProgress: 19, stability: 100 }),
    ])

    const result = tick(lab)

    expect(result.lab.worlds['Пепельный Шпиль']!.studied).toBe(3)
    expect(result.events).toEqual([
      {
        type: 'creatureStudied',
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        studied: 2,
        creatures: 4,
      },
      {
        type: 'creatureStudied',
        portal: 'ПШ-449-2',
        world: 'Пепельный Шпиль',
        studied: 3,
        creatures: 4,
      },
    ])
  })

  it('последнее существо изучено: наблюдатели всех открытых порталов мира возвращаются, другой мир не затронут', () => {
    const lab = labWith(
      [
        portal({ name: 'ПШ-449-1', observers: 2, studyProgress: 18, stability: 100 }),
        portal({ name: 'ПШ-449-2', observers: 1, studyProgress: 5, stability: 100 }),
        portal({
          name: 'ЛД-102-1',
          world: 'Ледяной Дол',
          observers: 1,
          studyProgress: 4,
          stability: 100,
        }),
      ],
      {
        staff: { free: 0, hireTicksLeft: 0, lost: 0 },
        worlds: {
          'Пепельный Шпиль': {
            name: 'Пепельный Шпиль',
            code: 'ПШ-449',
            creatures: 4,
            studied: 3,
            visits: 1,
          },
          'Ледяной Дол': {
            name: 'Ледяной Дол',
            code: 'ЛД-102',
            creatures: 4,
            studied: 0,
            visits: 1,
          },
        },
      },
    )

    const result = tick(lab)

    expect(result.lab.staff.free).toBe(3)
    expect(result.lab.worlds['Пепельный Шпиль']!.studied).toBe(4)
    expect(result.lab.portals[0]).toMatchObject({ observers: 0, studyProgress: 0 })
    expect(result.lab.portals[1]).toMatchObject({ observers: 0, studyProgress: 0 })
    expect(result.lab.portals[2]).toMatchObject({ observers: 1, studyProgress: 5 })
    expect(result.events).toEqual([
      {
        type: 'creatureStudied',
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        studied: 4,
        creatures: 4,
      },
      { type: 'worldStudied', world: 'Пепельный Шпиль', creatures: 4, returned: 3 },
    ])
  })

  it('наблюдатели в уже изученном мире не накапливают прогресс и не дают событий', () => {
    const lab = labWith([portal({ observers: 2, studyProgress: 6, stability: 100 })], {
      worlds: {
        'Пепельный Шпиль': {
          name: 'Пепельный Шпиль',
          code: 'ПШ-449',
          creatures: 4,
          studied: 4,
          visits: 1,
        },
      },
    })

    const result = tick(lab)

    expect(result.lab.portals[0]).toMatchObject({ observers: 2, studyProgress: 6 })
    expect(result.lab.worlds['Пепельный Шпиль']!.studied).toBe(4)
    expect(result.events).toEqual([])
  })

  it('порядок шагов: вернувшийся портал в этот же тик деградирует в полную силу (80 → −0.4)', () => {
    const lab = labWith([portal({ energy: 80, stability: 50, observers: 1, studyProgress: 19 })], {
      worlds: {
        'Пепельный Шпиль': {
          name: 'Пепельный Шпиль',
          code: 'ПШ-449',
          creatures: 2,
          studied: 1,
          visits: 1,
        },
      },
    })

    const result = tick(lab)

    expect(result.lab.portals[0]).toMatchObject({ observers: 0, stability: 49.6 })
    expect(result.lab.staff.free).toBe(4)
  })

  it('портал, обработанный позже в том же тике, после возврата наблюдателей ничего не делает', () => {
    const lab = labWith(
      [
        portal({ name: 'ПШ-449-1', observers: 1, studyProgress: 19, stability: 100 }),
        portal({ name: 'ПШ-449-2', observers: 1, studyProgress: 19, stability: 100 }),
      ],
      {
        worlds: {
          'Пепельный Шпиль': {
            name: 'Пепельный Шпиль',
            code: 'ПШ-449',
            creatures: 2,
            studied: 1,
            visits: 1,
          },
        },
      },
    )

    const result = tick(lab)

    expect(result.lab.worlds['Пепельный Шпиль']!.studied).toBe(2)
    expect(result.events.map((e) => e.type)).toEqual(['creatureStudied', 'worldStudied'])
    expect(result.events[1]).toMatchObject({ returned: 2 })
  })
})
