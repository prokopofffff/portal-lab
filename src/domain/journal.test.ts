import { describe, expect, it } from 'vitest'
import { advance, dispatch, filterLog } from './journal'
import { createLab, type Lab, type LogEntry, type Portal } from './lab'
import type { Rng } from './rng'

// ГСЧ на нижних границах: мир всегда Пепельный Шпиль, метрики минимальные
const minRng: Rng = {
  next: () => 0,
  int: (min) => min,
  pick: (list) => list[0]!,
  state: () => 0,
}

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)

describe('dispatch: действие попадает в журнал (spec §5, §8)', () => {
  it('открытие портала в новый мир пишет запись-действие с порталом, миром и временем', () => {
    const lab = { ...createLab(), time: 143 }
    const result = dispatch(lab, { type: 'openPortal' }, minRng, NOW)

    expect(result.lab.log).toEqual([
      {
        time: 143,
        realTime: NOW,
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        kind: 'action',
        text: 'Открыт портал ПШ-449-1 (Пепельный Шпиль) — новый мир',
      },
    ])
    expect(result.lab.portals).toHaveLength(1)
    expect(result.events).toEqual([
      { type: 'portalOpened', portal: 'ПШ-449-1', world: 'Пепельный Шпиль', firstVisit: true },
    ])
  })

  it('повторное посещение мира дописывается после первой записи', () => {
    const first = dispatch(createLab(), { type: 'openPortal' }, minRng, NOW).lab
    const lab = dispatch({ ...first, time: 7 }, { type: 'openPortal' }, minRng, NOW + 7000).lab

    expect(lab.log.map((e) => [e.time, e.realTime, e.portal, e.text])).toEqual([
      [0, NOW, 'ПШ-449-1', 'Открыт портал ПШ-449-1 (Пепельный Шпиль) — новый мир'],
      [7, NOW + 7000, 'ПШ-449-2', 'Открыт портал ПШ-449-2 (Пепельный Шпиль) — повторное посещение'],
    ])
  })
})

// 12 открытых порталов: все арки заняты
function fullLab(): Lab {
  let lab = createLab()
  for (let i = 0; i < 12; i++) lab = dispatch(lab, { type: 'openPortal' }, minRng, NOW).lab
  return lab
}

describe('dispatch: отказ попадает в журнал (spec §5, §8)', () => {
  it('отказ возвращает причину и добавляет запись-отказ, остальное состояние не меняется', () => {
    const full = { ...fullLab(), time: 50 }
    const result = dispatch(full, { type: 'openPortal' }, minRng, NOW + 1)

    expect(result.rejection).toBe('Открыто 12 порталов из 12 — все арки заняты')
    expect(result.events).toEqual([])
    expect(result.lab.log.at(-1)).toEqual({
      time: 50,
      realTime: NOW + 1,
      portal: null,
      world: null,
      kind: 'rejection',
      text: 'Отказ «Открыть портал»: открыто 12 порталов из 12 — все арки заняты',
    })
    expect({ ...result.lab, log: full.log }).toEqual(full)
    expect(result.lab.log).toHaveLength(13)
  })
})

// Лаборатория с n системными записями «запись 0» … «запись n−1»
function labWithLog(n: number): Lab {
  const log = Array.from({ length: n }, (_, i) => ({
    time: i,
    realTime: NOW,
    portal: null,
    world: null,
    kind: 'system' as const,
    text: `запись ${i}`,
  }))
  return { ...createLab(), log }
}

describe('dispatch: журнал хранит последние 500 записей (spec §8, Приложение B)', () => {
  it('при 500 записях новое действие вытесняет самую старую', () => {
    const { log } = dispatch(labWithLog(500), { type: 'openPortal' }, minRng, NOW).lab

    expect(log).toHaveLength(500)
    expect(log[0]!.text).toBe('запись 1')
    expect(log.at(-1)!.text).toBe('Открыт портал ПШ-449-1 (Пепельный Шпиль) — новый мир')
  })

  it('отказ тоже вытесняет самую старую запись', () => {
    const full = { ...fullLab(), log: labWithLog(500).log }
    const { log } = dispatch(full, { type: 'openPortal' }, minRng, NOW).lab

    expect(log).toHaveLength(500)
    expect(log[0]!.text).toBe('запись 1')
    expect(log.at(-1)!.kind).toBe('rejection')
  })

  it('меньше 500 записей не обрезается', () => {
    const { log } = dispatch(labWithLog(498), { type: 'openPortal' }, minRng, NOW).lab
    expect(log).toHaveLength(499)
    expect(log[0]!.text).toBe('запись 0')
  })
})

describe('filterLog: история портала и мира (spec §8)', () => {
  function entry(
    text: string,
    kind: LogEntry['kind'],
    portal: string | null,
    world: string | null,
  ) {
    return { time: 0, realTime: NOW, portal, world, kind, text }
  }
  const log: LogEntry[] = [
    entry('открыт ПТ-420-1', 'action', 'ПТ-420-1', 'Пепельные Топи'),
    entry('открыт ББ-310-1', 'action', 'ББ-310-1', 'Багровая Бездна'),
    entry('схлопнулся ПТ-420-1', 'system', 'ПТ-420-1', 'Пепельные Топи'),
    entry('все арки заняты', 'rejection', null, null),
    entry('открыт ПТ-420-2', 'action', 'ПТ-420-2', 'Пепельные Топи'),
    entry('отказ стабилизации ПТ-420-2', 'rejection', 'ПТ-420-2', 'Пепельные Топи'),
  ]
  const texts = (entries: LogEntry[]) => entries.map((e) => e.text)

  it('без фильтров возвращает весь журнал по порядку', () => {
    expect(filterLog(log, {})).toEqual(log)
  })

  it('по порталу — только его записи, включая отказы', () => {
    expect(texts(filterLog(log, { portal: 'ПТ-420-2' }))).toEqual([
      'открыт ПТ-420-2',
      'отказ стабилизации ПТ-420-2',
    ])
  })

  it('по миру — все его порталы, включая прошлые', () => {
    expect(texts(filterLog(log, { world: 'Пепельные Топи' }))).toEqual([
      'открыт ПТ-420-1',
      'схлопнулся ПТ-420-1',
      'открыт ПТ-420-2',
      'отказ стабилизации ПТ-420-2',
    ])
  })

  it('по типу записи', () => {
    expect(texts(filterLog(log, { kind: 'rejection' }))).toEqual([
      'все арки заняты',
      'отказ стабилизации ПТ-420-2',
    ])
  })

  it('фильтры складываются', () => {
    expect(texts(filterLog(log, { world: 'Пепельные Топи', kind: 'action' }))).toEqual([
      'открыт ПТ-420-1',
      'открыт ПТ-420-2',
    ])
  })
})

// Открытый портал без наблюдателей; переопределения задают нужную метрику
function openPortal(overrides: Partial<Portal> = {}): Portal {
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

// Лаборатория с порталами и миром «Пепельный Шпиль» (4 существа, изучено 1)
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

// Ожидаемая системная запись тика
function expectedSystemEntry(
  time: number,
  portal: string | null,
  world: string | null,
  text: string,
): LogEntry {
  return { time, realTime: NOW, portal, world, kind: 'system', text }
}

describe('advance: системные записи тика (spec §4, §8)', () => {
  it('завершение найма: запись без портала и мира, время — после тика', () => {
    const lab = labWith([], { time: 9, staff: { free: 2, hireTicksLeft: 1, lost: 0 } })

    const result = advance(lab, NOW)

    expect(result.lab.log).toEqual([
      expectedSystemEntry(10, null, null, 'Наём завершён: свободных наблюдателей +1'),
    ])
  })

  it('изучено существо: портал, мир и счёт «изучено из всего»', () => {
    // Два наблюдателя, прогресс 18 + 2 = 20 — порог существа; мир: 1 → 2 из 4
    const lab = labWith([openPortal({ observers: 2, studyProgress: 18 })], { time: 4 })

    const result = advance(lab, NOW)

    expect(result.lab.log).toEqual([
      expectedSystemEntry(
        5,
        'ПШ-449-1',
        'Пепельный Шпиль',
        'ПШ-449-1 (Пепельный Шпиль): изучено существо — 2 из 4',
      ),
    ])
  })

  it('мир изучен: все существа и число вернувшихся наблюдателей, после записи об изучении', () => {
    // Изучено 3 из 4, два наблюдателя доводят прогресс до порога — последнее существо
    const lab = labWith([openPortal({ observers: 2, studyProgress: 18 })], {
      time: 4,
      worlds: {
        'Пепельный Шпиль': {
          name: 'Пепельный Шпиль',
          code: 'ПШ-449',
          creatures: 4,
          studied: 3,
          visits: 1,
        },
      },
    })

    const result = advance(lab, NOW)

    expect(result.lab.log).toEqual([
      expectedSystemEntry(
        5,
        'ПШ-449-1',
        'Пепельный Шпиль',
        'ПШ-449-1 (Пепельный Шпиль): изучено существо — 4 из 4',
      ),
      expectedSystemEntry(
        5,
        null,
        'Пепельный Шпиль',
        'Мир Пепельный Шпиль изучен: все существа (4) — наблюдатели вернулись: 2',
      ),
    ])
  })

  it('схлопывание по времени: портал, мир и причина', () => {
    const lab = labWith([openPortal({ timeLeft: 1 })], { time: 20 })

    const result = advance(lab, NOW)

    expect(result.lab.log).toEqual([
      expectedSystemEntry(
        21,
        'ПШ-449-1',
        'Пепельный Шпиль',
        'ПШ-449-1 (Пепельный Шпиль) схлопнулся: время вышло',
      ),
    ])
  })

  it('схлопывание по стабильности: причина — стабильность упала до 0', () => {
    const lab = labWith([openPortal({ stability: 0.1 })], { time: 20 })

    const result = advance(lab, NOW)

    expect(result.lab.log).toEqual([
      expectedSystemEntry(
        21,
        'ПШ-449-1',
        'Пепельный Шпиль',
        'ПШ-449-1 (Пепельный Шпиль) схлопнулся: стабильность упала до 0',
      ),
    ])
  })

  it('потеряны наблюдатели: количество в записи', () => {
    const lab = labWith([openPortal({ timeLeft: 1, observers: 2 })], { time: 20 })

    const result = advance(lab, NOW)

    expect(result.lab.log.at(-1)).toEqual(
      expectedSystemEntry(
        21,
        'ПШ-449-1',
        'Пепельный Шпиль',
        'ПШ-449-1 (Пепельный Шпиль): потеряно наблюдателей — 2',
      ),
    )
  })

  it('смена уровня риска: от какого к какому', () => {
    // Энергия 90, время 91: балл 54 (средний) → после тика 55 (высокий)
    const lab = labWith([openPortal({ energy: 90, timeLeft: 91 })], { time: 20 })

    const result = advance(lab, NOW)

    expect(result.lab.log).toEqual([
      expectedSystemEntry(
        21,
        'ПШ-449-1',
        'Пепельный Шпиль',
        'ПШ-449-1 (Пепельный Шпиль): уровень риска: средний → высокий',
      ),
    ])
  })

  it('принятие снято: уровень принятия и новый уровень, после записи о смене уровня', () => {
    // Фикстура проверяет только тексты: acceptedAt 'low' при портале уже на среднем уровне — искусственное состояние.
    // Принят на низком, тик поднимает средний → высокий: смена уровня, затем снятие принятия
    const lab = labWith([openPortal({ energy: 90, timeLeft: 91, acceptedAt: 'low' })], { time: 20 })

    const result = advance(lab, NOW)

    expect(result.lab.log).toEqual([
      expectedSystemEntry(
        21,
        'ПШ-449-1',
        'Пепельный Шпиль',
        'ПШ-449-1 (Пепельный Шпиль): уровень риска: средний → высокий',
      ),
      expectedSystemEntry(
        21,
        'ПШ-449-1',
        'Пепельный Шпиль',
        'ПШ-449-1 (Пепельный Шпиль): принятие снято — уровень риска вырос: низкий → высокий',
      ),
    ])
  })

  it('тик без событий не добавляет записей, но двигает время', () => {
    const entry = expectedSystemEntry(3, null, null, 'Старая запись')
    const lab = labWith([openPortal()], { time: 7, log: [entry] })

    const result = advance(lab, NOW)

    expect(result.lab.time).toBe(8)
    expect(result.lab.log).toEqual([entry])
    expect(result.events).toEqual([])
  })

  it('журнал обрезается до 500 записей, если тик дописывает сверх лимита', () => {
    const lab = {
      ...labWith([openPortal({ timeLeft: 1, observers: 2 })]),
      log: labWithLog(500).log,
    }

    const { log } = advance(lab, NOW).lab

    // Тик добавил две записи (схлопнулся, потеряно) — вытеснены «запись 0» и «запись 1»
    expect(log).toHaveLength(500)
    expect(log[0]!.text).toBe('запись 2')
    expect(log.at(-1)!.text).toBe('ПШ-449-1 (Пепельный Шпиль): потеряно наблюдателей — 2')
  })

  it('несколько событий тика идут в журнале в порядке событий', () => {
    const lab = labWith([openPortal({ timeLeft: 1, observers: 2 })], { time: 20 })

    const { log } = advance(lab, NOW).lab

    expect(log.map((e) => e.text)).toEqual([
      'ПШ-449-1 (Пепельный Шпиль) схлопнулся: время вышло',
      'ПШ-449-1 (Пепельный Шпиль): потеряно наблюдателей — 2',
    ])
  })
})

describe('dispatch sealLab: запечатать лабораторию (spec §5)', () => {
  it('очищает журнал, без отказа, события пусты', () => {
    const full = fullLab()
    const lab: Lab = {
      ...full,
      time: 143,
      staff: { free: 1, hireTicksLeft: 5, lost: 2 },
      log: labWithLog(10).log,
    }

    const result = dispatch(lab, { type: 'sealLab' }, minRng, NOW)

    expect(result.lab.log).toEqual([])
    expect(result.rejection).toBeUndefined()
    expect(result.events).toEqual([])
  })
})

describe('dispatch stabilize: журнал (spec §5, §8)', () => {
  const stabilize = { type: 'stabilize', portal: 'ПШ-449-1' } as const

  it('запись-действие с баллами риска до и после', () => {
    // Балл 49 → 31, уровень остаётся средним
    const lab = labWith([openPortal()], { time: 12 })

    const result = dispatch(lab, stabilize, minRng, NOW)

    expect(result.lab.log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        kind: 'action',
        text: 'Стабилизирован ПШ-449-1 (Пепельный Шпиль): балл риска 49 → 31',
      },
    ])
    expect(result.rejection).toBeUndefined()
  })

  it('смена уровня: после записи-действия идёт системная запись с тем же текстом, что у тика', () => {
    // Балл 55 (высокий) → 37 (средний)
    const lab = labWith([openPortal({ stability: 35 })], { time: 12 })

    const result = dispatch(lab, stabilize, minRng, NOW)

    expect(result.lab.log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        kind: 'action',
        text: 'Стабилизирован ПШ-449-1 (Пепельный Шпиль): балл риска 55 → 37',
      },
      {
        time: 12,
        realTime: NOW,
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        kind: 'system',
        text: 'ПШ-449-1 (Пепельный Шпиль): уровень риска: высокий → средний',
      },
    ])
  })

  it('отказ: запись с порталом, миром и причиной, перезарядка не меняется', () => {
    const lab = labWith([openPortal({ cooldown: 12 })], { time: 12 })

    const result = dispatch(lab, stabilize, minRng, NOW)

    expect(result.rejection).toBe('Кулдаун стабилизации — осталось 12 мин')
    expect(result.events).toEqual([])
    expect(result.lab.log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        kind: 'rejection',
        text: 'Отказ «Стабилизировать» ПШ-449-1 (Пепельный Шпиль): кулдаун стабилизации — осталось 12 мин',
      },
    ])
    expect(result.lab.portals).toEqual(lab.portals)
  })

  it('отказ при стабильности 95%: запись о запрете стабилизации', () => {
    const lab = labWith([openPortal({ stability: 95 })], { time: 12 })

    const { log } = dispatch(lab, stabilize, minRng, NOW).lab

    expect(log.map((e) => e.text)).toEqual([
      'Отказ «Стабилизировать» ПШ-449-1 (Пепельный Шпиль): стабильность 95% или выше — стабилизация запрещена',
    ])
  })

  it('отказ для закрытого портала: мир берётся из портала', () => {
    const lab = labWith([openPortal({ status: 'closed' })], { time: 12 })

    const { log } = dispatch(lab, stabilize, minRng, NOW).lab

    expect(log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        kind: 'rejection',
        text: 'Отказ «Стабилизировать» ПШ-449-1 (Пепельный Шпиль): портал не открыт',
      },
    ])
  })

  it('отказ для неизвестного портала: имя без мира, world — null', () => {
    const lab = labWith([openPortal()], { time: 12 })

    const { log } = dispatch(lab, { type: 'stabilize', portal: 'ББ-310-1' }, minRng, NOW).lab

    expect(log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: 'ББ-310-1',
        world: null,
        kind: 'rejection',
        text: 'Отказ «Стабилизировать» ББ-310-1: портал не открыт',
      },
    ])
  })
})

describe('dispatch sendObserver: журнал (spec §5, §8)', () => {
  const send = { type: 'sendObserver', portal: 'ПШ-449-1' } as const

  it('запись-действие с числом наблюдателей на месте', () => {
    const lab = labWith([openPortal({ observers: 1 })], { time: 12 })

    const result = dispatch(lab, send, minRng, NOW)

    expect(result.lab.log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        kind: 'action',
        text: 'ПШ-449-1 (Пепельный Шпиль): отправлен наблюдатель — на месте 2',
      },
    ])
    expect(result.rejection).toBeUndefined()
  })

  it('отказ: запись с порталом, миром и причиной', () => {
    const lab = labWith([openPortal({ observers: 3 })], { time: 12 })

    const result = dispatch(lab, send, minRng, NOW)

    expect(result.rejection).toBe('На месте уже 3 наблюдателя')
    expect(result.lab.log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        kind: 'rejection',
        text: 'Отказ «Отправить наблюдателя» ПШ-449-1 (Пепельный Шпиль): на месте уже 3 наблюдателя',
      },
    ])
  })
})

describe('dispatch recallObservers: журнал (spec §5, §8)', () => {
  const recall = { type: 'recallObservers', portal: 'ПШ-449-1' } as const

  it('запись-действие с числом отозванных', () => {
    const lab = labWith([openPortal({ observers: 2, studyProgress: 5 })], { time: 12 })

    const result = dispatch(lab, recall, minRng, NOW)

    expect(result.lab.log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        kind: 'action',
        text: 'ПШ-449-1 (Пепельный Шпиль): отозвано наблюдателей — 2, прогресс изучения сброшен',
      },
    ])
    expect(result.rejection).toBeUndefined()
  })

  it('отказ: запись с порталом, миром и причиной', () => {
    const lab = labWith([openPortal()], { time: 12 })

    const result = dispatch(lab, recall, minRng, NOW)

    expect(result.rejection).toBe('На месте никого нет')
    expect(result.lab.log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: 'ПШ-449-1',
        world: 'Пепельный Шпиль',
        kind: 'rejection',
        text: 'Отказ «Отозвать наблюдателей» ПШ-449-1 (Пепельный Шпиль): на месте никого нет',
      },
    ])
  })
})

describe('dispatch hireObserver: журнал (spec §5, §8)', () => {
  const hire = { type: 'hireObserver' } as const

  it('запись-действие без портала и мира', () => {
    const lab = { ...createLab(), time: 12 }

    const result = dispatch(lab, hire, minRng, NOW)

    expect(result.lab.log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: null,
        world: null,
        kind: 'action',
        text: 'Начат наём наблюдателя — будет через 20 мин',
      },
    ])
    expect(result.lab.staff.hireTicksLeft).toBe(20)
    expect(result.events).toEqual([{ type: 'hireStarted', ticks: 20 }])
  })

  it('отказ: запись без портала и мира', () => {
    const lab = { ...createLab(), time: 12, staff: { free: 2, hireTicksLeft: 12, lost: 0 } }

    const result = dispatch(lab, hire, minRng, NOW)

    expect(result.rejection).toBe('Наём уже идёт — осталось 12 мин')
    expect(result.lab.log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: null,
        world: null,
        kind: 'rejection',
        text: 'Отказ «Нанять наблюдателя»: наём уже идёт — осталось 12 мин',
      },
    ])
  })

  it('отказ «штат полон» пишется в журнал', () => {
    const lab = { ...createLab(), staff: { free: 5, hireTicksLeft: 0, lost: 0 } }

    const { log } = dispatch(lab, hire, minRng, NOW).lab

    expect(log.map((e) => e.text)).toEqual(['Отказ «Нанять наблюдателя»: штат полон: 5 из 5'])
  })
})

// Запись-действие или отказ по порталу ПШ-449-1 в лаборатории со временем 12
function portalEntry(kind: 'action' | 'rejection', text: string): LogEntry {
  return {
    time: 12,
    realTime: NOW,
    portal: 'ПШ-449-1',
    world: 'Пепельный Шпиль',
    kind,
    text,
  }
}

describe('dispatch closePortal: журнал (spec §5, §8)', () => {
  const close = { type: 'closePortal', portal: 'ПШ-449-1' } as const

  it('последний открытый в мир с неизученными: запись называет, сколько не изучено', () => {
    const lab = labWith([openPortal()], { time: 12 })

    const result = dispatch(lab, close, minRng, NOW)

    expect(result.lab.log).toEqual([
      portalEntry(
        'action',
        'Закрыт портал ПШ-449-1 (Пепельный Шпиль) — последний открытый в мир, не изучено 3 из 4',
      ),
    ])
    expect(result.rejection).toBeUndefined()
  })

  it('есть другой открытый портал в мир: короткая запись', () => {
    const lab = labWith([openPortal(), openPortal({ name: 'ПШ-449-2', arch: 1 })], { time: 12 })

    const result = dispatch(lab, close, minRng, NOW)

    expect(result.lab.log).toEqual([
      portalEntry('action', 'Закрыт портал ПШ-449-1 (Пепельный Шпиль)'),
    ])
  })

  it('отказ при наблюдателях: запись с порталом, миром и причиной', () => {
    const lab = labWith([openPortal({ observers: 1 })], { time: 12 })

    const result = dispatch(lab, close, minRng, NOW)

    expect(result.rejection).toBe('На месте наблюдатели — сначала отзовите')
    expect(result.lab.log).toEqual([
      portalEntry(
        'rejection',
        'Отказ «Закрыть» ПШ-449-1 (Пепельный Шпиль): на месте наблюдатели — сначала отзовите',
      ),
    ])
  })
})

describe('dispatch cancelClose: журнал (spec §5, §8)', () => {
  const cancel = { type: 'cancelClose', portal: 'ПШ-449-1' } as const

  it('отмена закрытия пишется в журнал, остальное состояние не меняется', () => {
    const lab = labWith([openPortal()], { time: 12 })

    const result = dispatch(lab, cancel, minRng, NOW)

    expect(result.lab.log).toEqual([
      portalEntry('action', 'Закрытие ПШ-449-1 (Пепельный Шпиль) отменено'),
    ])
    expect({ ...result.lab, log: [] }).toEqual(lab)
  })

  it('отказ у неизвестного портала: в записи его имя без мира', () => {
    const lab = labWith([], { time: 12 })

    const result = dispatch(lab, { type: 'cancelClose', portal: 'ПШ-449-9' }, minRng, NOW)

    expect(result.rejection).toBe('Портал не открыт')
    expect(result.lab.log).toEqual([
      {
        time: 12,
        realTime: NOW,
        portal: 'ПШ-449-9',
        world: null,
        kind: 'rejection',
        text: 'Отказ «Закрыть» ПШ-449-9: портал не открыт',
      },
    ])
  })
})

describe('dispatch toggleQuestioned: журнал (spec §5, §8)', () => {
  const toggle = { type: 'toggleQuestioned', portal: 'ПШ-449-1' } as const

  it('пометка с заметкой: запись содержит заметку', () => {
    const lab = labWith([openPortal()], { time: 12 })

    const result = dispatch(lab, { ...toggle, note: ' странный шум ' }, minRng, NOW)

    expect(result.lab.log).toEqual([
      portalEntry('action', 'ПШ-449-1 (Пепельный Шпиль): пометка «Под вопросом» — странный шум'),
    ])
  })

  it('пометка без заметки: запись без тире', () => {
    const lab = labWith([openPortal()], { time: 12 })

    const result = dispatch(lab, toggle, minRng, NOW)

    expect(result.lab.log).toEqual([
      portalEntry('action', 'ПШ-449-1 (Пепельный Шпиль): пометка «Под вопросом»'),
    ])
  })

  it('снятие пометки', () => {
    const lab = labWith([openPortal({ questioned: { note: 'шум' } })], { time: 12 })

    const result = dispatch(lab, toggle, minRng, NOW)

    expect(result.lab.log).toEqual([
      portalEntry('action', 'ПШ-449-1 (Пепельный Шпиль): пометка «Под вопросом» снята'),
    ])
  })

  it('отказ у закрытого портала', () => {
    const lab = labWith([openPortal({ status: 'closed' })], { time: 12 })

    const result = dispatch(lab, toggle, minRng, NOW)

    expect(result.lab.log).toEqual([
      portalEntry('rejection', 'Отказ «Под вопросом» ПШ-449-1 (Пепельный Шпиль): портал не открыт'),
    ])
  })
})

describe('dispatch acceptAsIs: журнал (spec §5, §8)', () => {
  const accept = { type: 'acceptAsIs', portal: 'ПШ-449-1' } as const

  it('запись с уровнем риска на момент принятия', () => {
    const lab = labWith([openPortal()], { time: 12 })

    const result = dispatch(lab, accept, minRng, NOW)

    expect(result.lab.log).toEqual([
      portalEntry('action', 'ПШ-449-1 (Пепельный Шпиль): принят как есть — уровень риска средний'),
    ])
  })

  it('отказ при критическом риске', () => {
    const lab = labWith([openPortal({ stability: 15 })], { time: 12 })

    const result = dispatch(lab, accept, minRng, NOW)

    expect(result.rejection).toBe('Риск критический — принять как есть нельзя')
    expect(result.lab.log).toEqual([
      portalEntry(
        'rejection',
        'Отказ «Принять как есть» ПШ-449-1 (Пепельный Шпиль): риск критический — принять как есть нельзя',
      ),
    ])
  })

  it('отказ, если уже принят', () => {
    const lab = labWith([openPortal({ acceptedAt: 'low' })], { time: 12 })

    const result = dispatch(lab, accept, minRng, NOW)

    expect(result.lab.log).toEqual([
      portalEntry(
        'rejection',
        'Отказ «Принять как есть» ПШ-449-1 (Пепельный Шпиль): портал уже принят как есть',
      ),
    ])
  })
})
