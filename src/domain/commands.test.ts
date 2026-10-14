import { describe, expect, it } from 'vitest'
import { execute } from './commands'
import { createLab, type Lab, type Portal } from './lab'
import { tick } from './tick'
import type { Rng } from './rng'

// ГСЧ, который всегда выдаёт нижнюю или верхнюю границу: так видно, из каких диапазонов берутся метрики
function edgeRng(edge: 'min' | 'max'): Rng {
  return {
    next: () => (edge === 'min' ? 0 : 0.999999),
    int: (min, max) => (edge === 'min' ? min : max),
    pick: (list) => list[edge === 'min' ? 0 : list.length - 1]!,
    state: () => 0,
  }
}

describe('execute openPortal: первое открытие (spec §2, §5)', () => {
  it('в пустой лаборатории открывает портал в новый мир с метриками на нижних границах', () => {
    const result = execute(createLab(), { type: 'openPortal' }, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals).toEqual([
      {
        name: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        status: 'open',
        arch: 0,
        energy: 10,
        stability: 20,
        timeLeft: 30,
        observers: 0,
        studyProgress: 0,
        cooldown: 0,
        questioned: null,
        acceptedAt: null,
      },
    ])
    expect(result.lab.worlds['Пепельный Шпиль']).toEqual({
      name: 'Пепельный Шпиль',
      code: 'ПШ-449',
      creatures: 0,
      studied: 0,
      visits: 1,
    })
  })

  it('метрики и существа доходят до верхних границ диапазонов', () => {
    const result = execute(createLab(), { type: 'openPortal' }, edgeRng('max'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]).toMatchObject({
      name: 'МП-999-1',
      world: 'Мерцающие Пустоши',
      energy: 95,
      stability: 100,
      timeLeft: 400,
    })
    expect(result.lab.worlds['Мерцающие Пустоши']?.creatures).toBe(15)
  })

  it('сообщает событие «портал открыт» с пометкой нового мира', () => {
    const result = execute(createLab(), { type: 'openPortal' }, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.events).toEqual([
      { type: 'portalOpened', portal: 'ПШ-449-1', world: 'Пепельный Шпиль', firstVisit: true },
    ])
  })

  it('не меняет исходную лабораторию', () => {
    const lab = createLab()
    execute(lab, { type: 'openPortal' }, edgeRng('min'))
    expect(lab).toEqual(createLab())
  })
})

// Успешный результат команды или падение теста с причиной отказа
function opened(lab: Lab, rng: Rng): Lab {
  const result = execute(lab, { type: 'openPortal' }, rng)
  if ('rejection' in result) throw new Error(result.rejection)
  return result.lab
}

describe('execute openPortal: повторное посещение (spec §2.1, §2.2)', () => {
  // Первый портал в Пепельный Шпиль открыт; в мире 9 существ, 4 изучены
  function labWithKnownWorld(): Lab {
    const lab = opened(createLab(), edgeRng('min'))
    const world = lab.worlds['Пепельный Шпиль']!
    return { ...lab, worlds: { 'Пепельный Шпиль': { ...world, creatures: 9, studied: 4 } } }
  }
  // Снова Пепельный Шпиль, но все числа — верхние границы
  const sameWorldMaxRng: Rng = { ...edgeRng('max'), pick: (list) => list[0]! }

  it('сохраняет существ и изученных мира, посещений +1', () => {
    const lab = opened(labWithKnownWorld(), sameWorldMaxRng)
    expect(lab.worlds['Пепельный Шпиль']).toEqual({
      name: 'Пепельный Шпиль',
      code: 'ПШ-449',
      creatures: 9,
      studied: 4,
      visits: 2,
    })
  })

  it('создаёт новый портал со своим номером посещения и новыми метриками, первый остаётся открытым', () => {
    const lab = opened(labWithKnownWorld(), sameWorldMaxRng)
    expect(lab.portals.map((p) => [p.name, p.world, p.status, p.energy])).toEqual([
      ['ПШ-449-1', 'Пепельный Шпиль', 'open', 10],
      ['ПШ-449-2', 'Пепельный Шпиль', 'open', 95],
    ])
  })

  it('событие помечает посещение как повторное', () => {
    const result = execute(labWithKnownWorld(), { type: 'openPortal' }, sameWorldMaxRng)
    if ('rejection' in result) throw new Error(result.rejection)
    expect(result.events).toEqual([
      { type: 'portalOpened', portal: 'ПШ-449-2', world: 'Пепельный Шпиль', firstVisit: false },
    ])
  })
})

function openTimes(lab: Lab, count: number): Lab {
  for (let i = 0; i < count; i++) lab = opened(lab, edgeRng('min'))
  return lab
}

describe('execute openPortal: арки зала (spec §9)', () => {
  it('порталы занимают арки по порядку с нулевой', () => {
    const lab = openTimes(createLab(), 3)
    expect(lab.portals.map((p) => p.arch)).toEqual([0, 1, 2])
  })

  it('новый портал встаёт в первую освободившуюся арку, остальные не сдвигаются', () => {
    const three = openTimes(createLab(), 3)
    // Портал во второй арке закрыт: арка 1 свободна (команды «Закрыть» пока нет — правим состояние)
    const closedMiddle: Lab = {
      ...three,
      portals: three.portals.map((p) => (p.arch === 1 ? { ...p, status: 'closed' } : p)),
    }
    const lab = opened(closedMiddle, edgeRng('min'))
    expect(lab.portals.map((p) => [p.name, p.status, p.arch])).toEqual([
      ['ПШ-449-1', 'open', 0],
      ['ПШ-449-2', 'closed', 1],
      ['ПШ-449-3', 'open', 2],
      ['ПШ-449-4', 'open', 1],
    ])
  })
})

describe('execute openPortal: лимит открытых (spec §5)', () => {
  it('при 12 открытых порталах 13-й получает отказ, лаборатория не меняется', () => {
    const full = openTimes(createLab(), 12)
    expect(full.portals.map((p) => p.arch)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])

    const result = execute(full, { type: 'openPortal' }, edgeRng('min'))
    expect(result).toEqual({ rejection: 'Открыто 12 порталов из 12 — все арки заняты' })
    expect(full.portals).toHaveLength(12)
    expect(full.worlds['Пепельный Шпиль']?.visits).toBe(12)
  })

  it('закрытые порталы в лимит не входят', () => {
    const full = openTimes(createLab(), 12)
    const oneClosed: Lab = {
      ...full,
      portals: full.portals.map((p) => (p.arch === 5 ? { ...p, status: 'closed' } : p)),
    }
    const lab = opened(oneClosed, edgeRng('min'))
    expect(lab.portals.at(-1)).toMatchObject({ name: 'ПШ-449-13', arch: 5 })
  })
})

describe('execute sealLab: запечатать лабораторию (spec §5)', () => {
  it('сбрасывает лабораторию: порталы, миры, журнал, время, найм и потери — всё как новая, события пусты', () => {
    const full = openTimes(createLab(), 2)
    const lab: Lab = {
      ...full,
      time: 143,
      staff: { free: 1, hireTicksLeft: 5, lost: 2 },
      log: [{ time: 0, realTime: 0, portal: null, world: null, kind: 'action', text: 'test' }],
    }

    const result = execute(lab, { type: 'sealLab' }, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab).toEqual(createLab())
    expect(result.events).toEqual([])
  })

  it('не расходует ГСЧ', () => {
    const fail = (): never => {
      throw new Error('sealLab не должен трогать ГСЧ')
    }
    const rng: Rng = { next: fail, int: fail, pick: fail, state: fail }

    const result = execute(openTimes(createLab(), 2), { type: 'sealLab' }, rng)

    expect('rejection' in result).toBe(false)
  })

  it('не меняет исходную лабораторию', () => {
    const lab: Lab = {
      ...openTimes(createLab(), 2),
      time: 143,
      staff: { free: 1, hireTicksLeft: 5, lost: 2 },
    }
    execute(lab, { type: 'sealLab' }, edgeRng('min'))
    expect(lab.time).toBe(143)
    expect(lab.portals).toHaveLength(2)
  })
})

// Открытый портал без наблюдателей; переопределения задают нужную метрику
function openPortalWith(overrides: Partial<Portal> = {}): Portal {
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

// Лаборатория с одним порталом
function labWithPortal(overrides: Partial<Portal> = {}): Lab {
  return { ...createLab(), portals: [openPortalWith(overrides)] }
}

describe('execute stabilize: эффект (spec §5)', () => {
  it('стабильность +25, энергия −10, время +20, перезарядка 30; остальное не меняется', () => {
    const lab = labWithPortal({ observers: 2, studyProgress: 5, acceptedAt: 'high' })

    const result = execute(lab, { type: 'stabilize', portal: 'ПШ-449-1' }, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals).toEqual([
      openPortalWith({
        stability: 75,
        energy: 70,
        timeLeft: 120,
        cooldown: 30,
        observers: 2,
        studyProgress: 5,
        acceptedAt: 'high',
      }),
    ])
    expect(result.lab.time).toBe(lab.time)
    expect(result.lab.worlds).toBe(lab.worlds)
  })
})

describe('execute stabilize: границы метрик (spec §3, Приложение B)', () => {
  it('стабильность не поднимается выше 100, энергия не опускается ниже 0, время без потолка', () => {
    const lab = labWithPortal({ stability: 90, energy: 5, timeLeft: 395 })

    const result = execute(lab, { type: 'stabilize', portal: 'ПШ-449-1' }, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]).toMatchObject({ stability: 100, energy: 0, timeLeft: 415 })
  })
})

describe('execute stabilize: события и уровень риска (spec §3, §5)', () => {
  it('балл и уровень падают: событие «стабилизирован» и затем «уровень риска изменился»', () => {
    // До: 0,4·65 + 0,3·80 + 0,3·16,67 = 26 + 24 + 5 = 55 (высокий). После (стаб. 60, энергия 70, время 120): 16 + 21 + 0 = 37 (средний)
    const lab = labWithPortal({ stability: 35 })

    const result = execute(lab, { type: 'stabilize', portal: 'ПШ-449-1' }, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.events).toEqual([
      {
        type: 'portalStabilized',
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        scoreFrom: 55,
        scoreTo: 37,
      },
      {
        type: 'riskLevelChanged',
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        from: 'high',
        to: 'medium',
      },
    ])
  })

  it('уровень не изменился: только событие «стабилизирован»', () => {
    // До: 20 + 24 + 5 = 49 (средний). После (стаб. 75, энергия 70, время 120): 10 + 21 + 0 = 31 (всё ещё средний)
    const result = execute(
      labWithPortal(),
      { type: 'stabilize', portal: 'ПШ-449-1' },
      edgeRng('min'),
    )
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.events).toEqual([
      {
        type: 'portalStabilized',
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        scoreFrom: 49,
        scoreTo: 31,
      },
    ])
  })
})

describe('execute stabilize: отказы (spec §5)', () => {
  const stabilizeCommand = { type: 'stabilize', portal: 'ПШ-449-1' } as const

  it('портала с таким именем нет: «Портал не открыт»', () => {
    const result = execute(
      labWithPortal(),
      { type: 'stabilize', portal: 'ББ-310-1' },
      edgeRng('min'),
    )
    expect(result).toEqual({ rejection: 'Портал не открыт' })
  })

  it('закрытый портал: «Портал не открыт»', () => {
    const result = execute(labWithPortal({ status: 'closed' }), stabilizeCommand, edgeRng('min'))
    expect(result).toEqual({ rejection: 'Портал не открыт' })
  })

  it('схлопнувшийся портал: «Портал не открыт»', () => {
    const result = execute(labWithPortal({ status: 'collapsed' }), stabilizeCommand, edgeRng('min'))
    expect(result).toEqual({ rejection: 'Портал не открыт' })
  })

  it('перезарядка идёт: отказ с оставшимися минутами', () => {
    const result = execute(labWithPortal({ cooldown: 12 }), stabilizeCommand, edgeRng('min'))
    expect(result).toEqual({ rejection: 'Кулдаун стабилизации — осталось 12 мин' })
  })

  it('стабильность ровно 95: стабилизировать не нужно', () => {
    const result = execute(labWithPortal({ stability: 95 }), stabilizeCommand, edgeRng('min'))
    expect(result).toEqual({
      rejection: 'Стабильность 95% или выше — стабилизировать не нужно',
    })
  })

  it('стабильность 94: стабилизация разрешена', () => {
    const result = execute(labWithPortal({ stability: 94 }), stabilizeCommand, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)
    expect(result.lab.portals[0]?.stability).toBe(100)
  })

  it('порядок проверок: закрытый портал важнее перезарядки, перезарядка важнее высокой стабильности', () => {
    const closed = labWithPortal({ status: 'closed', cooldown: 5, stability: 99 })
    expect(execute(closed, stabilizeCommand, edgeRng('min'))).toEqual({
      rejection: 'Портал не открыт',
    })
    const cooling = labWithPortal({ cooldown: 5, stability: 99 })
    expect(execute(cooling, stabilizeCommand, edgeRng('min'))).toEqual({
      rejection: 'Кулдаун стабилизации — осталось 5 мин',
    })
  })

  it('отказ не меняет лабораторию', () => {
    const lab = labWithPortal({ cooldown: 12 })
    execute(lab, stabilizeCommand, edgeRng('min'))
    expect(lab).toEqual(labWithPortal({ cooldown: 12 }))
  })
})

// n тиков подряд
function ticks(lab: Lab, n: number): Lab {
  for (let i = 0; i < n; i++) lab = tick(lab).lab
  return lab
}

describe('execute stabilize: перезарядка и время (spec §4, §5)', () => {
  const stabilizeCommand = { type: 'stabilize', portal: 'ПШ-449-1' } as const

  it('после стабилизации 29 тиков отказ «осталось 1 мин», на 30-м тике — снова можно', () => {
    // Энергия 10 → 0 после стабилизации: портал не деградирует и переживает ожидание
    const first = execute(
      labWithPortal({ energy: 10, stability: 40, timeLeft: 200 }),
      stabilizeCommand,
      edgeRng('min'),
    )
    if ('rejection' in first) throw new Error(first.rejection)

    const waiting = ticks(first.lab, 29)
    expect(execute(waiting, stabilizeCommand, edgeRng('min'))).toEqual({
      rejection: 'Кулдаун стабилизации — осталось 1 мин',
    })

    const ready = ticks(waiting, 1)
    const second = execute(ready, stabilizeCommand, edgeRng('min'))
    if ('rejection' in second) throw new Error(second.rejection)
    expect(second.lab.portals[0]?.cooldown).toBe(30)
  })

  it('непрерывная стабилизация не делает портал вечным: каждый цикл времени остаётся меньше, портал схлопывается', () => {
    // Цикл: +20 за стабилизацию, −30 и больше за ожидание. Энергия 50 хватает на 5 стабилизаций.
    // Стабильность после каждой возвращается к 100 и остывает на 0,2 / 0,15 / 0,1 / 0,05 за тик,
    // поэтому следующая возможна через 30, 34, 51 и 101 тик: 220, 220−30+20, 210−34+20, 196−51+20, 165−101+20
    let lab = labWithPortal({ energy: 50, stability: 60, timeLeft: 200 })
    const timeLeftAfterEach: number[] = []
    let collapsedAt = -1
    for (let minute = 0; minute < 2000 && collapsedAt === -1; minute++) {
      const result = execute(lab, stabilizeCommand, edgeRng('min'))
      if (!('rejection' in result)) {
        lab = result.lab
        timeLeftAfterEach.push(lab.portals[0]!.timeLeft)
      }
      lab = tick(lab).lab
      if (lab.portals[0]!.status === 'collapsed') collapsedAt = minute
    }

    expect(timeLeftAfterEach).toEqual([220, 210, 196, 165, 84])
    expect(collapsedAt).toBeGreaterThan(-1)
  })
})
