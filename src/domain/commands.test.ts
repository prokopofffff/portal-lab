import { describe, expect, it } from 'vitest'
import { execute } from './commands'
import { createLab, type Lab } from './lab'
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
