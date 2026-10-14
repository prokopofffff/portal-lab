import { describe, expect, it } from 'vitest'
import { createLab, type Lab, type Portal } from './lab'
import { attentionList, summarize } from './overview'

// Портал в заданном статусе; переопределения задают нужную метрику
function portalWith(overrides: Partial<Portal> = {}): Portal {
  return {
    name: 'ПШ-449-1',
    world: 'Пепельный Шпиль',
    status: 'open',
    arch: 0,
    energy: 40,
    stability: 80,
    timeLeft: 200,
    observers: 0,
    studyProgress: 0,
    cooldown: 0,
    questioned: null,
    acceptedAt: null,
    ...overrides,
  }
}

describe('summarize: сводка лаборатории (spec §7)', () => {
  it('пустая лаборатория: нули, предел 12 и три свободных наблюдателя', () => {
    expect(summarize(createLab())).toEqual({
      open: 0,
      maxOpen: 12,
      critical: 0,
      closed: 0,
      collapsed: 0,
      worlds: 0,
      studied: 0,
      creatures: 0,
      staff: { free: 3, onSite: 0, inTransit: 0, lost: 0 },
    })
  })
})

describe('summarize: смешанная лаборатория', () => {
  it('считает открытые, критические, закрытые, схлопнувшиеся, миры, существ и штат', () => {
    const lab: Lab = {
      ...createLab(),
      portals: [
        portalWith({ name: 'ПШ-449-1', stability: 12, observers: 2 }),
        portalWith({ name: 'ПШ-449-2', arch: 1, observers: 1 }),
        portalWith({ name: 'ТС-101-1', world: 'Тихий Склон', arch: 2, status: 'closed' }),
        portalWith({ name: 'ТС-101-2', world: 'Тихий Склон', arch: 3, status: 'collapsed' }),
      ],
      worlds: {
        'Пепельный Шпиль': {
          name: 'Пепельный Шпиль',
          code: 'ПШ-449',
          creatures: 9,
          studied: 3,
          visits: 2,
        },
        'Тихий Склон': {
          name: 'Тихий Склон',
          code: 'ТС-101',
          creatures: 5,
          studied: 5,
          visits: 2,
        },
      },
      staff: { free: 0, hireTicksLeft: 12, lost: 1 },
    }

    expect(summarize(lab)).toEqual({
      open: 2,
      maxOpen: 12,
      critical: 1,
      closed: 1,
      collapsed: 1,
      worlds: 2,
      studied: 8,
      creatures: 14,
      staff: { free: 0, onSite: 3, inTransit: 1, lost: 1 },
    })
  })
})

// Лаборатория с заданными порталами; миры: «Пепельный Шпиль» не изучен на 6 из 9, остальные — по умолчанию
function labOf(portals: Portal[], unstudiedByWorld: Record<string, number> = {}): Lab {
  const unstudied: Record<string, number> = { 'Пепельный Шпиль': 6, ...unstudiedByWorld }
  const worlds: Lab['worlds'] = {}
  for (const [name, left] of Object.entries(unstudied)) {
    worlds[name] = { name, code: 'ХХ-000', creatures: 9, studied: 9 - left, visits: 1 }
  }
  return { ...createLab(), portals, worlds }
}

describe('attentionList: причина (spec §7)', () => {
  it('пример из спецификации: критический · схлопнется через 8 мин · не изучено 6 · на месте 2 наблюдателя', () => {
    const lab = labOf([portalWith({ timeLeft: 8, observers: 2 })])

    expect(attentionList(lab)).toEqual([
      {
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        level: 'critical',
        reason: 'критический · схлопнется через 8 мин · не изучено 6 · на месте 2 наблюдателя',
      },
    ])
  })
})

describe('attentionList: причина без лишних частей', () => {
  it('без неизученных существ и наблюдателей остаются уровень и время', () => {
    const lab = labOf([portalWith({ timeLeft: 150 })], { 'Пепельный Шпиль': 0 })

    expect(attentionList(lab)[0]?.reason).toBe('низкий · схлопнется через 150 мин')
  })

  it('один наблюдатель — «наблюдатель», дробное время округляется вверх', () => {
    const lab = labOf([portalWith({ timeLeft: 149.2, observers: 1 })])

    expect(attentionList(lab)[0]?.reason).toBe(
      'низкий · схлопнется через 150 мин · не изучено 6 · на месте 1 наблюдатель',
    )
  })

  it('три наблюдателя — «наблюдателя»', () => {
    const lab = labOf([portalWith({ timeLeft: 150, observers: 3 })])

    expect(attentionList(lab)[0]?.reason).toBe(
      'низкий · схлопнется через 150 мин · не изучено 6 · на месте 3 наблюдателя',
    )
  })
})

describe('attentionList: кого включать', () => {
  it('принятые как есть, закрытые и схлопнувшиеся не попадают в список', () => {
    const lab = labOf([
      portalWith({ name: 'ПШ-449-1', timeLeft: 8, acceptedAt: 'critical' }),
      portalWith({ name: 'ПШ-449-2', arch: 1, timeLeft: 8, status: 'closed' }),
      portalWith({ name: 'ПШ-449-3', arch: 2, timeLeft: 8, status: 'collapsed' }),
      portalWith({ name: 'ПШ-449-4', arch: 3 }),
    ])

    expect(attentionList(lab).map((item) => item.portal)).toEqual(['ПШ-449-4'])
  })

  it('пустая лаборатория — пустой список', () => {
    expect(attentionList(createLab())).toEqual([])
  })
})

describe('attentionList: сортировка (spec §7)', () => {
  it('уровень риска по убыванию: критический, высокий, средний, низкий', () => {
    const lab = labOf([
      portalWith({ name: 'ПШ-449-1' }),
      portalWith({ name: 'ПШ-449-2', arch: 1, stability: 60, energy: 60 }),
      portalWith({ name: 'ПШ-449-3', arch: 2, stability: 30, energy: 95 }),
      portalWith({ name: 'ПШ-449-4', arch: 3, timeLeft: 8 }),
    ])

    const items = attentionList(lab)

    expect(items.map((item) => item.level)).toEqual(['critical', 'high', 'medium'])
    expect(items.map((item) => item.portal)).toEqual(['ПШ-449-4', 'ПШ-449-3', 'ПШ-449-2'])
  })

  it('при равном уровне раньше тот, у которого меньше времени', () => {
    const lab = labOf([
      portalWith({ name: 'ПШ-449-1', timeLeft: 9 }),
      portalWith({ name: 'ПШ-449-2', arch: 1, timeLeft: 4 }),
      portalWith({ name: 'ПШ-449-3', arch: 2, timeLeft: 7 }),
    ])

    expect(attentionList(lab).map((item) => item.portal)).toEqual([
      'ПШ-449-2',
      'ПШ-449-3',
      'ПШ-449-1',
    ])
  })

  it('при равных уровне и времени раньше тот, у чьего мира больше неизученных', () => {
    const lab = labOf(
      [
        portalWith({ name: 'ПШ-449-1', world: 'Тихий Склон', timeLeft: 8 }),
        portalWith({ name: 'ПШ-449-2', arch: 1, timeLeft: 8 }),
        portalWith({ name: 'ПШ-449-3', arch: 2, world: 'Алый Берег', timeLeft: 8 }),
      ],
      { 'Тихий Склон': 2, 'Алый Берег': 8 },
    )

    expect(attentionList(lab).map((item) => item.portal)).toEqual([
      'ПШ-449-3',
      'ПШ-449-2',
      'ПШ-449-1',
    ])
  })

  it('при полном равенстве сохраняется порядок порталов в лаборатории', () => {
    const lab = labOf([
      portalWith({ name: 'ПШ-449-1', timeLeft: 8 }),
      portalWith({ name: 'ПШ-449-2', arch: 1, timeLeft: 8 }),
    ])

    expect(attentionList(lab).map((item) => item.portal)).toEqual(['ПШ-449-1', 'ПШ-449-2'])
  })

  it('показывает только три первых из пяти', () => {
    const lab = labOf([
      portalWith({ name: 'ПШ-449-1' }),
      portalWith({ name: 'ПШ-449-2', arch: 1, timeLeft: 9 }),
      portalWith({ name: 'ПШ-449-3', arch: 2, timeLeft: 3 }),
      portalWith({ name: 'ПШ-449-4', arch: 3, timeLeft: 6 }),
      portalWith({ name: 'ПШ-449-5', arch: 4, stability: 60, energy: 60 }),
    ])

    expect(attentionList(lab).map((item) => item.portal)).toEqual([
      'ПШ-449-3',
      'ПШ-449-4',
      'ПШ-449-2',
    ])
  })
})
