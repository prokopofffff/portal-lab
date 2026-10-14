import { describe, expect, it } from 'vitest'
import { dispatch, filterLog } from './journal'
import { createLab, type Lab, type LogEntry } from './lab'
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
