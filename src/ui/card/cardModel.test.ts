import { describe, expect, it } from 'vitest'
import { labWith, logEntry, portal, world } from '../../test/labFixtures'
import { portalCard, type PortalCardModel } from './cardModel'

const TOPI = 'Пепельные Топи'
const MAYAK = 'Забытый Маяк'
const BEZDNA = 'Багровая Бездна'

function lab(
  portals: ReturnType<typeof portal>[],
  extra: Parameters<typeof labWith>[0]['log'] = [],
) {
  return labWith({
    worlds: {
      [TOPI]: world(TOPI, 'ПТ-420', { creatures: 9, studied: 3 }),
      [MAYAK]: world(MAYAK, 'ЗМ-517', { creatures: 5, studied: 1 }),
      [BEZDNA]: world(BEZDNA, 'ББ-310', { creatures: 0, studied: 0 }),
    },
    portals,
    log: extra,
  })
}

function card(
  portals: ReturnType<typeof portal>[],
  name: string,
  log: Parameters<typeof lab>[1] = [],
) {
  const model = portalCard(lab(portals, log), name)
  expect(model).not.toBeNull()
  return model as PortalCardModel
}

const partsOf = (m: PortalCardModel) => m.parts.map((p) => p.value)

describe('portalCard: шапка', () => {
  it('нет такого портала — null', () => {
    expect(portalCard(lab([]), 'ПТ-420-1')).toBeNull()
  })

  it('открытый портал: имя, мир, слово статуса, риск', () => {
    const m = card(
      [portal('ПТ-420-1', TOPI, { energy: 80, stability: 30, timeLeft: 40 })],
      'ПТ-420-1',
    )
    expect(m).toMatchObject({
      name: 'ПТ-420-1',
      world: TOPI,
      status: 'open',
      statusWord: 'ОТКРЫТ',
      risk: { level: 'high', score: 72, label: 'Высокий' },
      lastRisk: null,
    })
  })

  it('закрытый и схлопнувшийся: слово статуса и «Последний риск» по последним метрикам', () => {
    const closed = card(
      [portal('ПТ-420-1', TOPI, { status: 'closed', energy: 28, stability: 81, timeLeft: 140 })],
      'ПТ-420-1',
    )
    expect(closed.status).toBe('closed')
    expect(closed.statusWord).toBe('ЗАКРЫТ')
    expect(closed.lastRisk).toBe('Последний риск: Низкий · 16')

    const collapsed = card(
      [portal('ЗМ-517-1', MAYAK, { status: 'collapsed', energy: 77, stability: 0, timeLeft: 0 })],
      'ЗМ-517-1',
    )
    expect(collapsed.statusWord).toBe('СХЛОПНУЛСЯ')
    expect(collapsed.lastRisk).toBe('Последний риск: Критический · 93')
  })
})

describe('portalCard: метрики', () => {
  it('энергия и стабильность округляются, время — вверх; полоски в процентах', () => {
    const m = card(
      [portal('ПТ-420-1', TOPI, { energy: 40.4, stability: 69.6, timeLeft: 199.2 })],
      'ПТ-420-1',
    )
    expect(m.metrics.energy).toEqual({ value: 40, pct: 40 })
    expect(m.metrics.stability).toEqual({ value: 70, pct: 70 })
    expect(m.metrics.timeLeft).toEqual({ value: 200, pct: 50 })
  })

  it('полоска времени: 100 % — самое долгое время нового портала (400), не больше 100', () => {
    const full = card([portal('ПТ-420-1', TOPI, { timeLeft: 400 })], 'ПТ-420-1')
    expect(full.metrics.timeLeft.pct).toBe(100)
    const over = card([portal('ПТ-420-1', TOPI, { timeLeft: 420 })], 'ПТ-420-1')
    expect(over.metrics.timeLeft.pct).toBe(100)
    const low = card([portal('ПТ-420-1', TOPI, { timeLeft: 8 })], 'ПТ-420-1')
    expect(low.metrics.timeLeft).toEqual({ value: 8, pct: 2 })
  })
})

describe('portalCard: разбор риска', () => {
  it('примеры спецификации: 13 = 4+9+0, 72 = 28+24+20, 41 = 35+6+0', () => {
    const m13 = card(
      [portal('ПТ-420-1', TOPI, { stability: 90, energy: 30, timeLeft: 200 })],
      'ПТ-420-1',
    )
    expect(partsOf(m13)).toEqual([4, 9, 0])
    expect(m13.risk.score).toBe(13)

    const m72 = card(
      [portal('ПТ-420-1', TOPI, { stability: 30, energy: 80, timeLeft: 40 })],
      'ПТ-420-1',
    )
    expect(partsOf(m72)).toEqual([28, 24, 20])
    expect(m72.risk.score).toBe(72)

    const m41 = card(
      [portal('ПТ-420-1', TOPI, { stability: 12.5, energy: 20, timeLeft: 200 })],
      'ПТ-420-1',
    )
    expect(partsOf(m41)).toEqual([35, 6, 0])
    expect(m41.risk.score).toBe(41)
  })

  it('подписи частей по порядку', () => {
    const m = card([portal('ПТ-420-1', TOPI)], 'ПТ-420-1')
    expect(m.parts.map((p) => p.label)).toEqual(['нестабильность', 'энергия', 'срочность'])
  })

  it('сумма округлённых частей равна баллу, даже когда обычное округление ошибается', () => {
    // 4,4 + 4,2 + 0 = 8,6 → балл 9; обычное округление дало бы 4+4+0 = 8
    const down = card(
      [portal('ПТ-420-1', TOPI, { stability: 89, energy: 14, timeLeft: 200 })],
      'ПТ-420-1',
    )
    expect(down.risk.score).toBe(9)
    expect(partsOf(down)).toEqual([5, 4, 0])

    // 4,6 + 4,5 + 0 = 9,1 → балл 9; обычное округление дало бы 5+5+0 = 10
    const up = card(
      [portal('ПТ-420-1', TOPI, { stability: 88.5, energy: 15, timeLeft: 200 })],
      'ПТ-420-1',
    )
    expect(up.risk.score).toBe(9)
    expect(partsOf(up)).toEqual([5, 4, 0])
  })

  it('сумма частей равна баллу на сетке метрик', () => {
    for (let stability = 0; stability <= 100; stability += 7) {
      for (let energy = 0; energy <= 100; energy += 9) {
        for (let timeLeft = 0; timeLeft <= 400; timeLeft += 13) {
          const m = card([portal('ПТ-420-1', TOPI, { stability, energy, timeLeft })], 'ПТ-420-1')
          expect(partsOf(m).reduce((a, b) => a + b, 0)).toBe(m.risk.score)
        }
      }
    }
  })

  it('жёсткое правило: время, затем стабильность; иначе null', () => {
    const none = card([portal('ПТ-420-1', TOPI, { stability: 80, timeLeft: 200 })], 'ПТ-420-1')
    expect(none.hardRule).toBeNull()
    const time = card([portal('ПТ-420-1', TOPI, { stability: 80, timeLeft: 10 })], 'ПТ-420-1')
    expect(time.hardRule).toBe('время ≤ 10 → критический')
    const stab = card([portal('ПТ-420-1', TOPI, { stability: 15, timeLeft: 200 })], 'ПТ-420-1')
    expect(stab.hardRule).toBe('стабильность ≤ 15 → критический')
    const both = card([portal('ПТ-420-1', TOPI, { stability: 5, timeLeft: 3 })], 'ПТ-420-1')
    expect(both.hardRule).toBe('время ≤ 10 → критический')
  })

  it('у архивного портала жёсткого правила нет (он уже не открыт)', () => {
    const m = card(
      [portal('ЗМ-517-1', MAYAK, { status: 'collapsed', timeLeft: 0, stability: 0 })],
      'ЗМ-517-1',
    )
    expect(m.hardRule).toBeNull()
  })
})

describe('portalCard: изучение', () => {
  it('мир, текущее существо и наблюдатели на месте', () => {
    const m = card([portal('ПТ-420-1', TOPI, { observers: 2, studyProgress: 12.4 })], 'ПТ-420-1')
    expect(m.study).toMatchObject({
      studied: 3,
      creatures: 9,
      worldPct: 33,
      current: { number: 4, pct: 62 },
      observers: 2,
      maxObservers: 3,
      others: [],
    })
  })

  it('прогресс — у этого портала, а не у лучшего в мире', () => {
    const m = card(
      [
        portal('ПТ-420-1', TOPI, { arch: 0, studyProgress: 18 }),
        portal('ПТ-420-2', TOPI, { arch: 1, studyProgress: 4 }),
      ],
      'ПТ-420-2',
    )
    expect(m.study.current).toEqual({ number: 4, pct: 20 })
  })

  it('прогресс не доходит до 100 %, как на плашке зала', () => {
    const m = card([portal('ПТ-420-1', TOPI, { studyProgress: 19.9 })], 'ПТ-420-1')
    expect(m.study.current?.pct).toBe(99)
  })

  it('мир изучен полностью или без существ — текущего существа нет', () => {
    const full = labWith({
      worlds: { [TOPI]: world(TOPI, 'ПТ-420', { creatures: 4, studied: 4 }) },
      portals: [portal('ПТ-420-1', TOPI)],
    })
    expect(portalCard(full, 'ПТ-420-1')?.study.current).toBeNull()
    expect(portalCard(full, 'ПТ-420-1')?.study.worldPct).toBe(100)
    const empty = card([portal('ББ-310-1', BEZDNA)], 'ББ-310-1')
    expect(empty.study.current).toBeNull()
    expect(empty.study.worldPct).toBe(0)
  })

  it('другие открытые порталы в тот же мир — по именам, без себя и без архива', () => {
    const portals = [
      portal('ПТ-420-1', TOPI, { arch: 0 }),
      portal('ПТ-420-2', TOPI, { arch: 1 }),
      portal('ПТ-420-3', TOPI, { arch: 2, status: 'closed' }),
      portal('ПТ-420-4', TOPI, { arch: 3 }),
      portal('ЗМ-517-1', MAYAK, { arch: 4 }),
    ]
    expect(card(portals, 'ПТ-420-1').study.others).toEqual(['ПТ-420-2', 'ПТ-420-4'])
    expect(card(portals, 'ПТ-420-2').study.others).toEqual(['ПТ-420-1', 'ПТ-420-4'])
  })

  it('архивный портал: текущего существа нет', () => {
    const m = card(
      [portal('ЗМ-517-1', MAYAK, { status: 'collapsed', studyProgress: 7 })],
      'ЗМ-517-1',
    )
    expect(m.study.current).toBeNull()
  })
})

describe('portalCard: совет', () => {
  it('строка «Действие — причина с маленькой буквы»', () => {
    const m = card(
      [portal('ББ-310-1', TOPI, { stability: 35, energy: 91, timeLeft: 46 })],
      'ББ-310-1',
    )
    expect(m.advice).toMatchObject({ action: 'stabilize', label: 'Стабилизировать' })
    expect(m.advice?.text).toBe('Стабилизировать — риск высокий — стабилизация снизит его')
  })

  it('подписи всех действий; keepOpen — «Оставить открытым»', () => {
    const labels = (p: ReturnType<typeof portal>, creatures = 9, studied = 3, free = 3) => {
      const l = labWith({
        worlds: { [TOPI]: world(TOPI, 'ПТ-420', { creatures, studied }) },
        portals: [p],
        staff: { free, hireTicksLeft: 0, lost: 0 },
      })
      return portalCard(l, p.name)?.advice
    }
    const crit = { stability: 5, timeLeft: 5 }
    expect(labels(portal('ПТ-420-1', TOPI, { ...crit, observers: 2 }))).toMatchObject({
      action: 'recallObservers',
      label: 'Отозвать наблюдателей',
    })
    expect(labels(portal('ПТ-420-1', TOPI, { ...crit, cooldown: 5 }))?.label).toBe('Закрыть')
    expect(labels(portal('ПТ-420-1', TOPI))?.label).toBe('Отправить наблюдателя')
    expect(labels(portal('ПТ-420-1', TOPI), 9, 3, 0)?.label).toBe('Принять как есть')
    expect(labels(portal('ПТ-420-1', TOPI, { acceptedAt: 'low' }), 9, 3, 0)).toMatchObject({
      action: 'keepOpen',
      label: 'Оставить открытым',
    })
  })

  it('у архивного портала совета нет', () => {
    expect(card([portal('ПТ-420-1', TOPI, { status: 'closed' })], 'ПТ-420-1').advice).toBeNull()
  })
})

describe('portalCard: способности', () => {
  const COMMANDS = [
    'stabilize',
    'closePortal',
    'sendObserver',
    'recallObservers',
    'toggleQuestioned',
    'acceptAsIs',
  ]

  it('шесть способностей в порядке макета с подписями', () => {
    const m = card([portal('ПТ-420-1', TOPI)], 'ПТ-420-1')
    expect(m.abilities.map((a) => a.command)).toEqual(COMMANDS)
    expect(m.abilities.map((a) => a.label)).toEqual([
      'Стабилизировать',
      'Закрыть',
      'Отправить наблюдателя',
      'Отозвать наблюдателей',
      'Под вопросом',
      'Принять как есть',
    ])
  })

  it('доступность и причина берутся из отказов домена', () => {
    const m = card([portal('ПТ-420-1', TOPI, { stability: 97, observers: 0 })], 'ПТ-420-1')
    const by = (c: string) => m.abilities.find((a) => a.command === c)!
    expect(by('stabilize')).toMatchObject({
      available: false,
      reason: 'Стабильность 95% или выше — стабилизация запрещена',
    })
    expect(by('recallObservers').available).toBe(false)
    expect(by('recallObservers').reason).toEqual(expect.any(String))
    expect(by('sendObserver')).toMatchObject({ available: true, reason: null })
    expect(by('closePortal')).toMatchObject({ available: true, reason: null })
    expect(by('toggleQuestioned')).toMatchObject({ available: true, reason: null })
    expect(by('acceptAsIs')).toMatchObject({ available: true, reason: null })
  })

  it('нет свободных наблюдателей — «отправить» недоступно с причиной домена', () => {
    const l = labWith({
      worlds: { [TOPI]: world(TOPI, 'ПТ-420') },
      portals: [portal('ПТ-420-1', TOPI)],
      staff: { free: 0, hireTicksLeft: 0, lost: 0 },
    })
    const send = portalCard(l, 'ПТ-420-1')!.abilities.find((a) => a.command === 'sendObserver')!
    expect(send.available).toBe(false)
    expect(send.reason).toEqual(expect.any(String))
  })

  it('рекомендованная способность — та, что в совете; keepOpen не рекомендует ничего', () => {
    const rec = (m: PortalCardModel) =>
      m.abilities.filter((a) => a.recommended).map((a) => a.command)
    expect(rec(card([portal('ПТ-420-1', TOPI)], 'ПТ-420-1'))).toEqual(['sendObserver'])
    expect(
      rec(
        card([portal('ПТ-420-1', TOPI, { stability: 35, energy: 91, timeLeft: 46 })], 'ПТ-420-1'),
      ),
    ).toEqual(['stabilize'])
    const kept = labWith({
      worlds: { [TOPI]: world(TOPI, 'ПТ-420') },
      portals: [portal('ПТ-420-1', TOPI, { acceptedAt: 'low' })],
      staff: { free: 0, hireTicksLeft: 0, lost: 0 },
    })
    expect(rec(portalCard(kept, 'ПТ-420-1')!)).toEqual([])
  })

  it('перезарядка стабилизации: осталось и доля прошедшего; без неё — null', () => {
    const cd = card([portal('ББ-310-1', TOPI, { cooldown: 12 })], 'ББ-310-1')
    const stab = cd.abilities[0]!
    expect(stab.available).toBe(false)
    expect(stab.reason).toBe('Кулдаун стабилизации — осталось 12 мин')
    expect(stab.cooldown).toEqual({ left: 12, elapsed: 0.6 })
    expect(cd.abilities.slice(1).every((a) => a.cooldown === null)).toBe(true)
    expect(card([portal('ББ-310-1', TOPI)], 'ББ-310-1').abilities[0]!.cooldown).toBeNull()
  })

  it('у закрытого и схлопнувшегося порталов способностей нет', () => {
    expect(card([portal('ПТ-420-1', TOPI, { status: 'closed' })], 'ПТ-420-1').abilities).toEqual([])
    expect(card([portal('ПТ-420-1', TOPI, { status: 'collapsed' })], 'ПТ-420-1').abilities).toEqual(
      [],
    )
  })
})

describe('portalCard: под вопросом', () => {
  it('null, если портал не помечен', () => {
    expect(card([portal('ПТ-420-1', TOPI)], 'ПТ-420-1').questioned).toBeNull()
  })
  it('заметка из пометки', () => {
    const m = card(
      [portal('ПТ-420-1', TOPI, { questioned: { note: 'Проверить энергию' } })],
      'ПТ-420-1',
    )
    expect(m.questioned).toEqual({ note: 'Проверить энергию' })
  })
  it('пустая заметка: портал помечен, текста нет', () => {
    const m = card([portal('ПТ-420-1', TOPI, { questioned: { note: '' } })], 'ПТ-420-1')
    expect(m.questioned).toEqual({ note: '' })
  })
})

describe('portalCard: история', () => {
  it('записи этого портала в порядке журнала с видом', () => {
    const log = [
      logEntry(120, 'Открыт портал ПТ-420-1', { portal: 'ПТ-420-1', kind: 'action' }),
      logEntry(121, 'Чужая запись', { portal: 'ПТ-420-2', kind: 'action' }),
      logEntry(137, 'Риск высокий → критический', { portal: 'ПТ-420-1', kind: 'system' }),
      logEntry(143, 'Отказ: нельзя', { portal: 'ПТ-420-1', kind: 'rejection' }),
    ]
    const m = card([portal('ПТ-420-1', TOPI)], 'ПТ-420-1', log)
    expect(m.history.map(({ time, text, kind }) => ({ time, text, kind }))).toEqual([
      { time: 120, text: 'Открыт портал ПТ-420-1', kind: 'action' },
      { time: 137, text: 'Риск высокий → критический', kind: 'system' },
      { time: 143, text: 'Отказ: нельзя', kind: 'rejection' },
    ])
  })

  it('ключи записей уникальны и устойчивы, даже у одинаковых записей в одну минуту', () => {
    const twin = logEntry(143, 'Отказ: нельзя', { portal: 'ПТ-420-1', kind: 'rejection' })
    const log = [logEntry(120, 'Открыт', { portal: 'ПТ-420-1', kind: 'action' }), twin, twin]
    const keys = card([portal('ПТ-420-1', TOPI)], 'ПТ-420-1', log).history.map((e) => e.key)
    expect(new Set(keys).size).toBe(3)
    // Старая запись ушла из журнала — ключи оставшихся не меняются
    const later = card([portal('ПТ-420-1', TOPI)], 'ПТ-420-1', log.slice(1)).history
    expect(later.map((e) => e.key)).toEqual(keys.slice(1))
  })
})

describe('portalCard: текст архива', () => {
  const closedLog = [
    logEntry(70, 'Открыт', { portal: 'ЯС-179-2', kind: 'action' }),
    logEntry(88, 'Закрыт', { portal: 'ЯС-179-2', kind: 'action' }),
    logEntry(95, 'Чужая запись', { portal: 'ПТ-420-1', kind: 'action' }),
  ]

  it('у открытого портала текста архива нет', () => {
    expect(card([portal('ПТ-420-1', TOPI)], 'ПТ-420-1').archive).toBeNull()
  })

  it('закрыт, мир изучен полностью', () => {
    const l = labWith({
      worlds: { 'Янтарный Сад': world('Янтарный Сад', 'ЯС-179', { creatures: 7, studied: 7 }) },
      portals: [portal('ЯС-179-2', 'Янтарный Сад', { status: 'closed' })],
      log: closedLog,
    })
    expect(portalCard(l, 'ЯС-179-2')?.archive).toBe(
      'Портал закрыт смотрителем на минуте 88. Мир изучен полностью — все 7 существ в атласе.',
    )
  })

  it('схлопнулся, существа остались в мире', () => {
    const m = card([portal('ЗМ-517-1', MAYAK, { status: 'collapsed' })], 'ЗМ-517-1', [
      logEntry(24, 'Схлопнулся', { portal: 'ЗМ-517-1' }),
    ])
    expect(m.archive).toBe(
      'Портал схлопнулся на минуте 24. Существа остались в мире «Забытый Маяк»: изучено 1 из 5, продолжить можно через новый портал в этот мир.',
    )
  })

  it('пустая история — без «на минуте»', () => {
    const m = card([portal('ЗМ-517-1', MAYAK, { status: 'collapsed' })], 'ЗМ-517-1')
    expect(m.archive).toMatch(/^Портал схлопнулся\. Существа остались/)
  })

  it('мир без существ', () => {
    const m = card([portal('ББ-310-1', BEZDNA, { status: 'closed' })], 'ББ-310-1', [
      logEntry(9, 'Закрыт', { portal: 'ББ-310-1' }),
    ])
    expect(m.archive).toBe(
      'Портал закрыт смотрителем на минуте 9. В мире «Багровая Бездна» нет существ.',
    )
  })
})
