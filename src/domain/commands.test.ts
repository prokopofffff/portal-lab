import { describe, expect, it } from 'vitest'
import { closeConfirmation, execute, hireRejection } from './commands'
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
      lastVisit: 0,
    })
  })

  it('время последнего посещения — время лаборатории на момент открытия', () => {
    const lab = { ...createLab(), time: 77 }
    expect(opened(lab, edgeRng('min')).worlds['Пепельный Шпиль']?.lastVisit).toBe(77)
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
    const lab = opened({ ...labWithKnownWorld(), time: 25 }, sameWorldMaxRng)
    expect(lab.worlds['Пепельный Шпиль']).toEqual({
      name: 'Пепельный Шпиль',
      code: 'ПШ-449',
      creatures: 9,
      studied: 4,
      visits: 2,
      lastVisit: 25,
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
    // Портал во второй арке закрыт: арка 1 свободна (состояние правим напрямую)
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

  it('стабильность ровно 95: стабилизация запрещена', () => {
    const result = execute(labWithPortal({ stability: 95 }), stabilizeCommand, edgeRng('min'))
    expect(result).toEqual({
      rejection: 'Стабильность 95% или выше — стабилизация запрещена',
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
    // Стабильность после первой — 85, после остальных — 100, и остывает на 0,2 / 0,15 / 0,1 / 0,05 за тик,
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

// Лаборатория с порталами и миром «Пепельный Шпиль» (4 существа, изучено 1)
function labWithWorld(portals: Portal[], overrides: Partial<Lab> = {}): Lab {
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
        lastVisit: 0,
      },
    },
    ...overrides,
  }
}

describe('execute sendObserver: эффект (spec §2.3, §5)', () => {
  const send = { type: 'sendObserver', portal: 'ПШ-449-1' } as const

  it('на портале на одного наблюдателя больше, свободных на одного меньше, событие с числом на месте', () => {
    const lab = labWithWorld([openPortalWith({ observers: 1 })])

    const result = execute(lab, send, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]?.observers).toBe(2)
    expect(result.lab.staff.free).toBe(2)
    expect(result.events).toEqual([
      { type: 'observerSent', portal: 'ПШ-449-1', world: 'Пепельный Шпиль', onSite: 2 },
    ])
    expect(lab.portals[0]?.observers).toBe(1)
    expect(lab.staff.free).toBe(3)
  })
})

describe('execute sendObserver: отказы (spec §5)', () => {
  const send = { type: 'sendObserver', portal: 'ПШ-449-1' } as const

  it('портала с таким именем нет: «Портал не открыт»', () => {
    const lab = labWithWorld([openPortalWith()])
    const result = execute(lab, { type: 'sendObserver', portal: 'ББ-310-1' }, edgeRng('min'))
    expect(result).toEqual({ rejection: 'Портал не открыт' })
  })

  it('закрытый портал: «Портал не открыт»', () => {
    const lab = labWithWorld([openPortalWith({ status: 'closed' })])
    expect(execute(lab, send, edgeRng('min'))).toEqual({ rejection: 'Портал не открыт' })
  })

  it('критический риск: наблюдателей не отправляют', () => {
    // Стабильность 10 ≤ 15 — жёсткое правило даёт критический уровень
    const lab = labWithWorld([openPortalWith({ stability: 10 })])
    expect(execute(lab, send, edgeRng('min'))).toEqual({
      rejection: 'Риск критический — наблюдателей не отправляют',
    })
  })
})

describe('execute sendObserver: отказы мира, места и штата (spec §5)', () => {
  const send = { type: 'sendObserver', portal: 'ПШ-449-1' } as const
  const world = (creatures: number, studied: number) => ({
    'Пепельный Шпиль': {
      name: 'Пепельный Шпиль',
      code: 'ПШ-449',
      creatures,
      studied,
      visits: 1,
      lastVisit: 0,
    },
  })

  it('в мире нет существ: нечего изучать', () => {
    const lab = labWithWorld([openPortalWith()], { worlds: world(0, 0) })
    expect(execute(lab, send, edgeRng('min'))).toEqual({
      rejection: 'Нечего изучать: в мире нет существ',
    })
  })

  it('все существа изучены: нечего изучать', () => {
    const lab = labWithWorld([openPortalWith()], { worlds: world(4, 4) })
    expect(execute(lab, send, edgeRng('min'))).toEqual({
      rejection: 'Нечего изучать: все существа мира изучены',
    })
  })

  it('осталось одно неизученное существо: отправить можно', () => {
    const lab = labWithWorld([openPortalWith()], { worlds: world(4, 3) })
    const result = execute(lab, send, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)
    expect(result.lab.portals[0]?.observers).toBe(1)
  })

  it('на месте уже три наблюдателя: отказ', () => {
    const lab = labWithWorld([openPortalWith({ observers: 3 })])
    expect(execute(lab, send, edgeRng('min'))).toEqual({
      rejection: 'На месте уже 3 наблюдателя',
    })
  })

  it('свободных наблюдателей нет: отказ', () => {
    const lab = labWithWorld([openPortalWith()], { staff: { free: 0, hireTicksLeft: 0, lost: 0 } })
    expect(execute(lab, send, edgeRng('min'))).toEqual({
      rejection: 'Нет свободных наблюдателей',
    })
  })

  it('порядок проверок: критический риск важнее пустого мира, пустой мир — важнее лимита и штата', () => {
    const noStaff = { free: 0, hireTicksLeft: 0, lost: 0 }
    const critical = labWithWorld([openPortalWith({ stability: 10, observers: 3 })], {
      worlds: world(0, 0),
      staff: noStaff,
    })
    expect(execute(critical, send, edgeRng('min'))).toEqual({
      rejection: 'Риск критический — наблюдателей не отправляют',
    })
    const empty = labWithWorld([openPortalWith({ observers: 3 })], {
      worlds: world(0, 0),
      staff: noStaff,
    })
    expect(execute(empty, send, edgeRng('min'))).toEqual({
      rejection: 'Нечего изучать: в мире нет существ',
    })
    const studied = labWithWorld([openPortalWith({ observers: 3 })], {
      worlds: world(4, 4),
      staff: noStaff,
    })
    expect(execute(studied, send, edgeRng('min'))).toEqual({
      rejection: 'Нечего изучать: все существа мира изучены',
    })
    const full = labWithWorld([openPortalWith({ observers: 3 })], { staff: noStaff })
    expect(execute(full, send, edgeRng('min'))).toEqual({
      rejection: 'На месте уже 3 наблюдателя',
    })
  })

  it('отказ не меняет лабораторию', () => {
    const lab = labWithWorld([openPortalWith({ observers: 3 })])
    execute(lab, send, edgeRng('min'))
    expect(lab).toEqual(labWithWorld([openPortalWith({ observers: 3 })]))
  })
})

describe('execute recallObservers (spec §5)', () => {
  const recall = { type: 'recallObservers', portal: 'ПШ-449-1' } as const

  it('наблюдатели возвращаются в свободные, прогресс текущего существа сбрасывается', () => {
    const lab = labWithWorld([openPortalWith({ observers: 2, studyProgress: 7 })], {
      staff: { free: 1, hireTicksLeft: 0, lost: 0 },
    })

    const result = execute(lab, recall, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]).toMatchObject({ observers: 0, studyProgress: 0 })
    expect(result.lab.staff.free).toBe(3)
    expect(result.lab.worlds['Пепельный Шпиль']?.studied).toBe(1)
    expect(result.events).toEqual([
      { type: 'observersRecalled', portal: 'ПШ-449-1', world: 'Пепельный Шпиль', count: 2 },
    ])
    expect(lab.portals[0]?.observers).toBe(2)
  })

  it('отзыв после изучения: изученные существа мира остаются, сбрасывается только прогресс', () => {
    // 3 наблюдателя: 7 тиков по 3 = 21 ≥ 20 — одно существо изучено, остаток прогресса 1
    let lab = labWithWorld([openPortalWith({ observers: 3, stability: 100, energy: 0 })])
    lab = ticks(lab, 7)
    expect(lab.worlds['Пепельный Шпиль']?.studied).toBe(2)
    expect(lab.portals[0]?.studyProgress).toBe(1)

    const result = execute(lab, recall, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]?.studyProgress).toBe(0)
    expect(result.lab.worlds['Пепельный Шпиль']?.studied).toBe(2)
  })

  it('портала с таким именем нет: «Портал не открыт»', () => {
    const lab = labWithWorld([openPortalWith({ observers: 1 })])
    const result = execute(lab, { type: 'recallObservers', portal: 'ББ-310-1' }, edgeRng('min'))
    expect(result).toEqual({ rejection: 'Портал не открыт' })
  })

  it('закрытый портал: «Портал не открыт»', () => {
    const lab = labWithWorld([openPortalWith({ status: 'closed', observers: 1 })])
    expect(execute(lab, recall, edgeRng('min'))).toEqual({ rejection: 'Портал не открыт' })
  })

  it('на портале никого нет: отказ', () => {
    const lab = labWithWorld([openPortalWith()])
    expect(execute(lab, recall, edgeRng('min'))).toEqual({ rejection: 'На месте никого нет' })
  })

  it('отказ не меняет лабораторию', () => {
    const lab = labWithWorld([openPortalWith()])
    execute(lab, recall, edgeRng('min'))
    expect(lab).toEqual(labWithWorld([openPortalWith()]))
  })
})

describe('execute hireObserver (spec §2.3, §5)', () => {
  const hire = { type: 'hireObserver' } as const
  const staffOf = (free: number, hireTicksLeft = 0) => ({ free, hireTicksLeft, lost: 0 })

  it('запускает наём на 20 тиков и сообщает об этом событием; свободные не меняются', () => {
    const lab = { ...createLab(), staff: staffOf(2) }

    const result = execute(lab, hire, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.staff).toEqual({ free: 2, hireTicksLeft: 20, lost: 0 })
    expect(result.events).toEqual([{ type: 'hireStarted', ticks: 20 }])
    expect(lab.staff.hireTicksLeft).toBe(0)
  })

  it('штат полон из свободных: пять из пяти', () => {
    const lab = { ...createLab(), staff: staffOf(5) }
    expect(execute(lab, hire, edgeRng('min'))).toEqual({
      rejection: 'Штат полон: 5 из 5',
    })
  })

  it('наблюдатели на открытых порталах входят в штат', () => {
    // 2 свободных + 2 + 1 на двух открытых порталах = 5
    const second = openPortalWith({ name: 'ПШ-449-2', arch: 1, observers: 1 })
    const lab = labWithWorld([openPortalWith({ observers: 2 }), second], { staff: staffOf(2) })
    expect(execute(lab, hire, edgeRng('min'))).toEqual({
      rejection: 'Штат полон: 5 из 5',
    })
  })

  it('наблюдатели на закрытом портале в штат не входят', () => {
    // Закрытый портал даёт 0 на месте: 4 свободных + 0 = 4 < 5
    const lab = labWithWorld([openPortalWith({ status: 'closed', observers: 2 })], {
      staff: staffOf(4),
    })
    const result = execute(lab, hire, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)
    expect(result.lab.staff.hireTicksLeft).toBe(20)
  })

  it('наём в пути считается за одного: четверо в штате и наём — пять из пяти', () => {
    const lab = { ...createLab(), staff: staffOf(4, 7) }
    expect(execute(lab, hire, edgeRng('min'))).toEqual({
      rejection: 'Штат полон: 5 из 5, включая наём в пути',
    })
  })

  it('наём уже идёт: отказ с оставшимися минутами', () => {
    const lab = { ...createLab(), staff: staffOf(2, 12) }
    expect(execute(lab, hire, edgeRng('min'))).toEqual({
      rejection: 'Наём уже идёт — осталось 12 мин',
    })
  })

  it('порядок проверок: полный штат важнее идущего найма', () => {
    const lab = { ...createLab(), staff: staffOf(4, 12) }
    expect(execute(lab, hire, edgeRng('min'))).toEqual({
      rejection: 'Штат полон: 5 из 5, включая наём в пути',
    })
  })

  it('отказ не меняет лабораторию', () => {
    const lab = { ...createLab(), staff: staffOf(2, 12) }
    execute(lab, hire, edgeRng('min'))
    expect(lab).toEqual({ ...createLab(), staff: staffOf(2, 12) })
  })

  it('наём завершается ровно через 20 тиков: после 19-го свободных ещё три, на 20-м — четыре', () => {
    const started = execute(createLab(), hire, edgeRng('min'))
    if ('rejection' in started) throw new Error(started.rejection)

    const waiting = ticks(started.lab, 19)
    expect(waiting.staff).toEqual({ free: 3, hireTicksLeft: 1, lost: 0 })

    const hired = ticks(waiting, 1)
    expect(hired.staff).toEqual({ free: 4, hireTicksLeft: 0, lost: 0 })
  })
})

describe('hireRejection (spec §5)', () => {
  const staffOf = (free: number, hireTicksLeft = 0) => ({ free, hireTicksLeft, lost: 0 })

  it('наём доступен: null', () => {
    expect(hireRejection(createLab())).toBeNull()
  })

  it('штат полон: та же причина, что у отказа команды', () => {
    expect(hireRejection({ ...createLab(), staff: staffOf(5) })).toBe('Штат полон: 5 из 5')
    expect(hireRejection({ ...createLab(), staff: staffOf(4, 7) })).toBe(
      'Штат полон: 5 из 5, включая наём в пути',
    )
  })

  it('наём уже идёт: оставшиеся минуты', () => {
    expect(hireRejection({ ...createLab(), staff: staffOf(2, 12) })).toBe(
      'Наём уже идёт — осталось 12 мин',
    )
  })
})

describe('наблюдатели двух порталов в один мир (spec §2.1, §4)', () => {
  it('счётчик изученных общий: каждый портал добавляет в него своё существо', () => {
    // Мир: 4 существа, изучено 1. На каждом портале прогресс 19 из 20 и после отправки по 1 наблюдателю
    const lab = labWithWorld([
      openPortalWith({ stability: 100, energy: 0, studyProgress: 19 }),
      openPortalWith({ name: 'ПШ-449-2', arch: 1, stability: 100, energy: 0, studyProgress: 19 }),
    ])
    const first = execute(lab, { type: 'sendObserver', portal: 'ПШ-449-1' }, edgeRng('min'))
    if ('rejection' in first) throw new Error(first.rejection)
    const second = execute(first.lab, { type: 'sendObserver', portal: 'ПШ-449-2' }, edgeRng('min'))
    if ('rejection' in second) throw new Error(second.rejection)

    const after = tick(second.lab).lab

    expect(after.worlds['Пепельный Шпиль']?.studied).toBe(3)
    expect(after.portals.map((p) => p.studyProgress)).toEqual([0, 0])
    expect(after.staff.free).toBe(1)
  })
})

describe('closeConfirmation: когда нужен диалог закрытия (spec §5)', () => {
  it('открытый портал, в мире есть неизученные и других открытых порталов в него нет — сводка', () => {
    const lab = labWithWorld([openPortalWith()])
    expect(closeConfirmation(lab, 'ПШ-449-1')).toEqual({
      world: 'Пепельный Шпиль',
      unstudied: 3,
      creatures: 4,
    })
  })

  it('неизвестный портал — null', () => {
    expect(closeConfirmation(labWithWorld([openPortalWith()]), 'нет-такого')).toBeNull()
  })

  it('закрытый или схлопнувшийся портал — null', () => {
    const closed = labWithWorld([openPortalWith({ status: 'closed' })])
    const collapsed = labWithWorld([openPortalWith({ status: 'collapsed' })])
    expect(closeConfirmation(closed, 'ПШ-449-1')).toBeNull()
    expect(closeConfirmation(collapsed, 'ПШ-449-1')).toBeNull()
  })

  it('мир изучен целиком — null', () => {
    const lab = labWithWorld([openPortalWith()])
    const studied = {
      ...lab,
      worlds: { 'Пепельный Шпиль': { ...lab.worlds['Пепельный Шпиль']!, studied: 4 } },
    }
    expect(closeConfirmation(studied, 'ПШ-449-1')).toBeNull()
  })

  it('в мире нет существ — null', () => {
    const lab = labWithWorld([openPortalWith()])
    const empty = {
      ...lab,
      worlds: {
        'Пепельный Шпиль': { ...lab.worlds['Пепельный Шпиль']!, creatures: 0, studied: 0 },
      },
    }
    expect(closeConfirmation(empty, 'ПШ-449-1')).toBeNull()
  })

  it('в тот же мир ведёт другой открытый портал — null', () => {
    const lab = labWithWorld([openPortalWith(), openPortalWith({ name: 'ПШ-449-2', arch: 1 })])
    expect(closeConfirmation(lab, 'ПШ-449-1')).toBeNull()
  })

  it('другой портал в тот же мир закрыт или схлопнулся — не в счёт, сводка есть', () => {
    const closedOther = labWithWorld([
      openPortalWith(),
      openPortalWith({ name: 'ПШ-449-2', arch: 1, status: 'closed' }),
    ])
    const collapsedOther = labWithWorld([
      openPortalWith(),
      openPortalWith({ name: 'ПШ-449-2', arch: 1, status: 'collapsed' }),
    ])
    const summary = { world: 'Пепельный Шпиль', unstudied: 3, creatures: 4 }
    expect(closeConfirmation(closedOther, 'ПШ-449-1')).toEqual(summary)
    expect(closeConfirmation(collapsedOther, 'ПШ-449-1')).toEqual(summary)
  })

  it('открытый портал в другой мир не мешает', () => {
    const lab = labWithWorld([
      openPortalWith(),
      openPortalWith({ name: 'ПТ-420-1', world: 'Пепельные Топи', arch: 1 }),
    ])
    expect(closeConfirmation(lab, 'ПШ-449-1')).toEqual({
      world: 'Пепельный Шпиль',
      unstudied: 3,
      creatures: 4,
    })
  })
})

describe('execute closePortal: эффект (spec §2.2, §5)', () => {
  const close = { type: 'closePortal', portal: 'ПШ-449-1' } as const

  it('портал закрыт, пометки и прогресс изучения сняты, остальные метрики остаются последними', () => {
    const lab = labWithWorld([
      openPortalWith({
        energy: 70,
        stability: 40,
        timeLeft: 55,
        cooldown: 7,
        studyProgress: 5,
        questioned: { note: 'странный шум' },
        acceptedAt: 'medium',
      }),
      openPortalWith({ name: 'ПШ-449-2', arch: 1 }),
    ])

    const result = execute(lab, close, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]).toEqual(
      openPortalWith({
        status: 'closed',
        energy: 70,
        stability: 40,
        timeLeft: 55,
        cooldown: 7,
        questioned: null,
        acceptedAt: null,
      }),
    )
    expect(result.lab.portals[1]).toEqual(openPortalWith({ name: 'ПШ-449-2', arch: 1 }))
  })

  it('мир не меняется, исходная лаборатория тоже', () => {
    const lab = labWithWorld([openPortalWith()])
    const result = execute(lab, close, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.worlds).toEqual(lab.worlds)
    expect(lab).toEqual(labWithWorld([openPortalWith()]))
  })
})

describe('execute closePortal: событие (spec §5)', () => {
  const close = { type: 'closePortal', portal: 'ПШ-449-1' } as const

  it('последний открытый в мир с неизученными: leftUnstudied с числами из диалога', () => {
    const result = execute(labWithWorld([openPortalWith()]), close, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.events).toEqual([
      {
        type: 'portalClosed',
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        leftUnstudied: { unstudied: 3, creatures: 4 },
      },
    ])
  })

  it('есть другой открытый портал в тот же мир: leftUnstudied = null', () => {
    const lab = labWithWorld([openPortalWith(), openPortalWith({ name: 'ПШ-449-2', arch: 1 })])
    const result = execute(lab, close, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.events).toEqual([
      { type: 'portalClosed', portal: 'ПШ-449-1', world: 'Пепельный Шпиль', leftUnstudied: null },
    ])
  })

  it('мир изучен целиком: leftUnstudied = null', () => {
    const base = labWithWorld([openPortalWith()])
    const lab = {
      ...base,
      worlds: { 'Пепельный Шпиль': { ...base.worlds['Пепельный Шпиль']!, studied: 4 } },
    }
    const result = execute(lab, close, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.events).toEqual([
      { type: 'portalClosed', portal: 'ПШ-449-1', world: 'Пепельный Шпиль', leftUnstudied: null },
    ])
  })
})

describe('execute closePortal: отказы (spec §5)', () => {
  const close = { type: 'closePortal', portal: 'ПШ-449-1' } as const

  it('неизвестный портал — «Портал не открыт»', () => {
    expect(
      execute(labWithWorld([openPortalWith()]), { ...close, portal: 'нет' }, edgeRng('min')),
    ).toEqual({
      rejection: 'Портал не открыт',
    })
  })

  it('закрытый или схлопнувшийся портал — «Портал не открыт»', () => {
    for (const status of ['closed', 'collapsed'] as const) {
      const lab = labWithWorld([openPortalWith({ status })])
      expect(execute(lab, close, edgeRng('min'))).toEqual({ rejection: 'Портал не открыт' })
    }
  })

  it('на месте наблюдатели — сначала отзовите, лаборатория не меняется', () => {
    const lab = labWithWorld([openPortalWith({ observers: 1 })])
    expect(execute(lab, close, edgeRng('min'))).toEqual({
      rejection: 'На месте наблюдатели — сначала отзовите',
    })
    expect(lab).toEqual(labWithWorld([openPortalWith({ observers: 1 })]))
  })
})

describe('execute cancelClose: отмена закрытия (spec §5)', () => {
  const cancel = { type: 'cancelClose', portal: 'ПШ-449-1' } as const

  it('состояние не меняется, событие — «закрытие отменено»', () => {
    const lab = labWithWorld([openPortalWith({ questioned: { note: 'шум' }, acceptedAt: 'high' })])

    const result = execute(lab, cancel, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab).toEqual(lab)
    expect(result.events).toEqual([
      { type: 'closeCancelled', portal: 'ПШ-449-1', world: 'Пепельный Шпиль' },
    ])
  })

  it('закрытый или неизвестный портал — «Портал не открыт»', () => {
    const closed = labWithWorld([openPortalWith({ status: 'closed' })])
    expect(execute(closed, cancel, edgeRng('min'))).toEqual({ rejection: 'Портал не открыт' })
    expect(execute(labWithWorld([]), cancel, edgeRng('min'))).toEqual({
      rejection: 'Портал не открыт',
    })
  })
})

describe('execute toggleQuestioned: «Под вопросом» (spec §5)', () => {
  const toggle = { type: 'toggleQuestioned', portal: 'ПШ-449-1' } as const

  it('без пометки ставит её с заметкой, заметка обрезается по краям', () => {
    const result = execute(
      labWithWorld([openPortalWith()]),
      { ...toggle, note: '  странный шум  ' },
      edgeRng('min'),
    )
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]!.questioned).toEqual({ note: 'странный шум' })
    expect(result.events).toEqual([
      {
        type: 'questionedMarked',
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        note: 'странный шум',
      },
    ])
  })

  it('без заметки пометка с пустой строкой', () => {
    const result = execute(labWithWorld([openPortalWith()]), toggle, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]!.questioned).toEqual({ note: '' })
    expect(result.events).toEqual([
      { type: 'questionedMarked', portal: 'ПШ-449-1', world: 'Пепельный Шпиль', note: '' },
    ])
  })

  it('заметка из одних пробелов становится пустой', () => {
    const result = execute(
      labWithWorld([openPortalWith()]),
      { ...toggle, note: '   ' },
      edgeRng('min'),
    )
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]!.questioned).toEqual({ note: '' })
  })

  it('с пометкой снимает её, новая заметка игнорируется', () => {
    const lab = labWithWorld([openPortalWith({ questioned: { note: 'шум' } })])

    const result = execute(lab, { ...toggle, note: 'другая' }, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]!.questioned).toBeNull()
    expect(result.events).toEqual([
      { type: 'questionedUnmarked', portal: 'ПШ-449-1', world: 'Пепельный Шпиль' },
    ])
  })

  it('остальное состояние не меняется', () => {
    const lab = labWithWorld([openPortalWith(), openPortalWith({ name: 'ПШ-449-2', arch: 1 })])

    const result = execute(lab, { ...toggle, note: 'шум' }, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]).toEqual(openPortalWith({ questioned: { note: 'шум' } }))
    expect(result.lab.portals[1]).toEqual(lab.portals[1])
    expect(result.lab.worlds).toEqual(lab.worlds)
    expect(lab.portals[0]!.questioned).toBeNull()
  })

  it('закрытый или неизвестный портал — «Портал не открыт»', () => {
    const closed = labWithWorld([openPortalWith({ status: 'closed' })])
    expect(execute(closed, toggle, edgeRng('min'))).toEqual({ rejection: 'Портал не открыт' })
    expect(execute(labWithWorld([]), toggle, edgeRng('min'))).toEqual({
      rejection: 'Портал не открыт',
    })
  })
})

describe('execute acceptAsIs: «Принять как есть» (spec §3, §5)', () => {
  const accept = { type: 'acceptAsIs', portal: 'ПШ-449-1' } as const

  it('запоминает текущий уровень риска (балл 49 — средний) и сообщает событие', () => {
    const lab = labWithWorld([openPortalWith(), openPortalWith({ name: 'ПШ-449-2', arch: 1 })])

    const result = execute(lab, accept, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]).toEqual(openPortalWith({ acceptedAt: 'medium' }))
    expect(result.lab.portals[1]).toEqual(lab.portals[1])
    expect(result.events).toEqual([
      { type: 'portalAccepted', portal: 'ПШ-449-1', world: 'Пепельный Шпиль', level: 'medium' },
    ])
    expect(lab.portals[0]!.acceptedAt).toBeNull()
  })

  it('низкий уровень тоже запоминается', () => {
    // Энергия 10, стабильность 100, времени много: балл 3 — низкий
    const lab = labWithWorld([openPortalWith({ energy: 10, stability: 100, timeLeft: 400 })])

    const result = execute(lab, accept, edgeRng('min'))
    if ('rejection' in result) throw new Error(result.rejection)

    expect(result.lab.portals[0]!.acceptedAt).toBe('low')
  })

  it('неизвестный, закрытый или схлопнувшийся портал — «Портал не открыт»', () => {
    expect(execute(labWithWorld([]), accept, edgeRng('min'))).toEqual({
      rejection: 'Портал не открыт',
    })
    for (const status of ['closed', 'collapsed'] as const) {
      const lab = labWithWorld([openPortalWith({ status })])
      expect(execute(lab, accept, edgeRng('min'))).toEqual({ rejection: 'Портал не открыт' })
    }
  })

  it('критический риск — принять нельзя', () => {
    // Стабильность 15 — жёсткое правило: критический при любом балле
    const lab = labWithWorld([openPortalWith({ stability: 15 })])
    expect(execute(lab, accept, edgeRng('min'))).toEqual({
      rejection: 'Риск критический — принять как есть нельзя',
    })
  })

  it('портал уже принят — отказ, принятие не перезаписывается', () => {
    const lab = labWithWorld([openPortalWith({ acceptedAt: 'low' })])
    expect(execute(lab, accept, edgeRng('min'))).toEqual({
      rejection: 'Портал уже принят как есть',
    })
  })

  it('порядок отказов: критический риск раньше «уже принят»', () => {
    const lab = labWithWorld([openPortalWith({ stability: 15, acceptedAt: 'low' })])
    expect(execute(lab, accept, edgeRng('min'))).toEqual({
      rejection: 'Риск критический — принять как есть нельзя',
    })
  })

  it('принятие снимается тиком, когда уровень вырос: балл 49 + 0,41 за тик, на 14-м тике 54,74 → 55 — высокий', () => {
    const accepted = execute(labWithWorld([openPortalWith()]), accept, edgeRng('min'))
    if ('rejection' in accepted) throw new Error(accepted.rejection)

    expect(ticks(accepted.lab, 13).portals[0]!.acceptedAt).toBe('medium')
    expect(ticks(accepted.lab, 14).portals[0]!.acceptedAt).toBeNull()
  })
})
