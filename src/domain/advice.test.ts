import { describe, expect, it } from 'vitest'
import { recommend } from './advice'
import { createLab, type Lab, type Portal } from './lab'

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

// Лаборатория с одним порталом и миром «Пепельный Шпиль» (9 существ, изучено 3)
function labWith(
  portal: Partial<Portal> = {},
  world: { creatures?: number; studied?: number } = {},
  free = 3,
): Lab {
  const lab = createLab()
  return {
    ...lab,
    portals: [openPortalWith(portal)],
    worlds: {
      'Пепельный Шпиль': {
        name: 'Пепельный Шпиль',
        code: 'ПШ-449',
        creatures: world.creatures ?? 9,
        studied: world.studied ?? 3,
        visits: 1,
      },
    },
    staff: { ...lab.staff, free },
  }
}

describe('recommend: критический риск и наблюдатели на месте (spec §6, правило 1)', () => {
  it('рекомендует отозвать наблюдателей, даже если стабилизация доступна', () => {
    const lab = labWith({ stability: 12, observers: 2 })

    expect(recommend(lab, 'ПШ-449-1')).toEqual({
      action: 'recallObservers',
      reason: 'Риск критический, на месте наблюдатели (2) — при схлопывании они будут потеряны',
    })
  })
})

describe('recommend: критический риск без наблюдателей (spec §6, правило 2)', () => {
  it('рекомендует стабилизировать, если стабилизация доступна', () => {
    const lab = labWith({ stability: 12 })

    expect(recommend(lab, 'ПШ-449-1')).toEqual({
      action: 'stabilize',
      reason: 'Риск критический — стабилизация поднимет стабильность и время до схлопывания',
    })
  })
})

describe('recommend: критический риск, стабилизация недоступна (spec §6, правило 3)', () => {
  it('рекомендует закрыть: кулдаун стабилизации и сколько существ останется не изучено', () => {
    const lab = labWith({ timeLeft: 8, cooldown: 12 })

    expect(recommend(lab, 'ПШ-449-1')).toEqual({
      action: 'closePortal',
      reason:
        'Риск критический, стабилизация недоступна (кулдаун стабилизации — осталось 12 мин) — в мире останется не изучено 6 из 9',
    })
  })

  it('если мир изучен полностью, в причине сказано, что неизученных не осталось', () => {
    const lab = labWith({ timeLeft: 8, cooldown: 12 }, { studied: 9 })

    expect(recommend(lab, 'ПШ-449-1')?.reason).toBe(
      'Риск критический, стабилизация недоступна (кулдаун стабилизации — осталось 12 мин) — в мире не осталось неизученных',
    )
  })

  it('при стабильности 95% и выше причиной названа запрещённая стабилизация', () => {
    const lab = labWith({ timeLeft: 8, stability: 96 })

    expect(recommend(lab, 'ПШ-449-1')).toEqual({
      action: 'closePortal',
      reason:
        'Риск критический, стабилизация недоступна (стабильность 95% или выше — стабилизация запрещена) — в мире останется не изучено 6 из 9',
    })
  })
})

describe('recommend: высокий риск (spec §6, правило 4)', () => {
  it('рекомендует стабилизировать, если стабилизация доступна', () => {
    // Пример из spec §3: стабильность 30, энергия 80, время 40 — балл 72, уровень высокий
    const lab = labWith({ stability: 30, energy: 80, timeLeft: 40 })

    expect(recommend(lab, 'ПШ-449-1')).toEqual({
      action: 'stabilize',
      reason: 'Риск высокий — стабилизация снизит его',
    })
  })
})

describe('recommend: высокий риск при перезарядке (spec §6)', () => {
  it('стабилизировать нельзя, поэтому рекомендация берётся из правил про изучение', () => {
    const lab = labWith(
      { stability: 30, energy: 80, timeLeft: 40, cooldown: 10, observers: 1 },
      {},
      2,
    )

    expect(recommend(lab, 'ПШ-449-1')?.action).toBe('sendObserver')
  })
})

describe('recommend: отправить наблюдателя (spec §6, правило 5)', () => {
  it('есть неизученные существа, место и свободный сотрудник — отправить наблюдателя', () => {
    const lab = labWith({ observers: 1 }, {}, 2)

    expect(recommend(lab, 'ПШ-449-1')).toEqual({
      action: 'sendObserver',
      reason: 'В мире не изучено 6 из 9, на месте 1 из 3 — отправьте наблюдателя',
    })
  })
})

describe('recommend: нечего изучать (spec §6, правило 6)', () => {
  it('мир изучен полностью — закрыть безопасно', () => {
    const lab = labWith({}, { studied: 9 })

    expect(recommend(lab, 'ПШ-449-1')).toEqual({
      action: 'closePortal',
      reason: 'Все существа мира изучены — закрыть безопасно',
    })
  })

  it('в мире нет существ — закрыть безопасно, причина про отсутствие существ', () => {
    const lab = labWith({}, { creatures: 0, studied: 0 })

    expect(recommend(lab, 'ПШ-449-1')).toEqual({
      action: 'closePortal',
      reason: 'В мире нет существ — закрыть безопасно',
    })
  })
})

describe('recommend: принять как есть (spec §6, правило 7)', () => {
  it('свободных наблюдателей нет — можно оставить открытым', () => {
    const lab = labWith({ observers: 1 }, {}, 0)

    expect(recommend(lab, 'ПШ-449-1')).toEqual({
      action: 'acceptAsIs',
      reason: 'Риск средний, свободных наблюдателей нет — можно оставить открытым',
    })
  })

  it('на месте три наблюдателя — отправлять некого, даже если свободные есть', () => {
    const lab = labWith({ observers: 3 }, {}, 2)

    expect(recommend(lab, 'ПШ-449-1')).toEqual({
      action: 'acceptAsIs',
      reason: 'Риск средний, на месте уже 3 наблюдателя — можно оставить открытым',
    })
  })

  it('портал уже принят как есть — причина говорит об этом', () => {
    const lab = labWith({ acceptedAt: 'medium' }, {}, 0)

    expect(recommend(lab, 'ПШ-449-1')).toEqual({
      action: 'keepOpen',
      reason: 'Уже принят как есть, риск средний — оставить открытым',
    })
  })
})

describe('recommend: нет подходящего портала', () => {
  it('для закрытого портала возвращает null', () => {
    const lab = labWith({ status: 'closed' })

    expect(recommend(lab, 'ПШ-449-1')).toBeNull()
  })

  it('для неизвестного имени возвращает null', () => {
    expect(recommend(labWith(), 'ЛГ-100-7')).toBeNull()
  })
})
