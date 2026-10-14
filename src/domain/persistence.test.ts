import { describe, expect, it } from 'vitest'
import { advance, dispatch } from './journal'
import { createLab, type Lab } from './lab'
import { SAVE_VERSION, parseSave, serializeSave, type SavedGame } from './persistence'
import { createRng } from './rng'

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)

// Живая лаборатория: несколько порталов и тиков, ГСЧ уже «проработал»
function buildSave(): SavedGame {
  const rng = createRng(42)
  let lab: Lab = createLab()
  for (let i = 0; i < 4; i++) {
    lab = dispatch(lab, { type: 'openPortal' }, rng, NOW + i).lab
  }
  for (let i = 0; i < 5; i++) {
    lab = advance(lab, NOW + 1000 * (i + 1)).lab
  }
  return { lab, rngState: rng.state() }
}

// Сохранение как объект: удобно ломать отдельные поля
function savedObject(): Record<string, unknown> {
  return JSON.parse(serializeSave(buildSave())) as Record<string, unknown>
}

function withLab(change: (lab: Record<string, unknown>) => void): string {
  const saved = savedObject()
  change(saved.lab as Record<string, unknown>)
  return JSON.stringify(saved)
}

describe('сохранение: туда и обратно (spec §10)', () => {
  it('лаборатория после открытий и тиков восстанавливается без потерь', () => {
    const save = buildSave()

    expect(save.lab.portals.length).toBeGreaterThan(1)
    expect(parseSave(serializeSave(save))).toEqual(save)
  })
})

describe('parseSave: принимает допустимые нетривиальные состояния (spec §10)', () => {
  it('закрытый и схлопнувшийся порталы, вопрос, принятие, изученные существа и все виды записей журнала', () => {
    const base = {
      arch: 0,
      energy: 40,
      stability: 62.5,
      timeLeft: 80,
      observers: 0,
      studyProgress: 0,
      cooldown: 0,
      questioned: null,
      acceptedAt: null,
    }
    const lab: Lab = {
      time: 12,
      portals: [
        { ...base, name: 'ПШ-449-1', world: 'Пепельный Шпиль', status: 'closed', cooldown: 3 },
        { ...base, name: 'ПШ-449-2', world: 'Пепельный Шпиль', status: 'collapsed', arch: 1 },
        {
          ...base,
          name: 'ЛД-102-1',
          world: 'Ледяной Дол',
          status: 'open',
          arch: 2,
          observers: 2,
          studyProgress: 7,
          questioned: { note: 'x' },
          acceptedAt: 'medium',
        },
      ],
      worlds: {
        'Пепельный Шпиль': {
          name: 'Пепельный Шпиль',
          code: 'ПШ-449',
          creatures: 4,
          studied: 2,
          visits: 2,
          lastVisit: 9,
        },
        'Ледяной Дол': {
          name: 'Ледяной Дол',
          code: 'ЛД-102',
          creatures: 3,
          studied: 0,
          visits: 1,
          lastVisit: 12,
        },
      },
      staff: { free: 1, hireTicksLeft: 2, lost: 1 },
      log: [
        {
          time: 1,
          realTime: NOW,
          portal: 'ПШ-449-1',
          world: 'Пепельный Шпиль',
          kind: 'action',
          text: 'a',
        },
        { time: 2, realTime: NOW, portal: null, world: null, kind: 'rejection', text: 'r' },
        { time: 3, realTime: NOW, portal: null, world: 'Ледяной Дол', kind: 'system', text: 's' },
      ],
    }
    const save: SavedGame = { lab, rngState: 123456 }

    expect(parseSave(serializeSave(save))).toEqual(save)
  })
})

describe('parseSave: непригодный ввод даёт null, не исключение', () => {
  it.each([null, '', '{', 'null', '[]', '42'])('%j', (raw) => {
    expect(parseSave(raw)).toBeNull()
  })
})

describe('parseSave: версия схемы', () => {
  it('чужая версия делает сохранение непригодным', () => {
    const saved = { ...savedObject(), version: SAVE_VERSION + 1 }

    expect(parseSave(JSON.stringify(saved))).toBeNull()
  })

  it('сохранение версии 1 (без lastVisit у миров) отвергается', () => {
    const saved = savedObject()
    for (const world of Object.values((saved.lab as { worlds: Record<string, object> }).worlds)) {
      delete (world as { lastVisit?: number }).lastVisit
    }

    expect(parseSave(JSON.stringify({ ...saved, version: 1 }))).toBeNull()
  })

  it('версия не задана', () => {
    const { version: _version, ...saved } = savedObject()

    expect(parseSave(JSON.stringify(saved))).toBeNull()
  })
})

describe('parseSave: состояние ГСЧ (lab-cl5.13)', () => {
  it.each([1.5, -1, 2 ** 32, '7', null])('rngState %j отвергается', (rngState) => {
    const saved = { ...savedObject(), rngState }

    expect(parseSave(JSON.stringify(saved))).toBeNull()
  })

  it('rngState не задан', () => {
    const { rngState: _rngState, ...saved } = savedObject()

    expect(parseSave(JSON.stringify(saved))).toBeNull()
  })

  it.each([0, 2 ** 32 - 1])('граничное rngState %d принимается', (rngState) => {
    const saved = { ...savedObject(), rngState }

    expect(parseSave(JSON.stringify(saved))?.rngState).toBe(rngState)
  })
})

describe('parseSave: форма лаборатории', () => {
  it.each([
    ['portals не массив', (lab: Record<string, unknown>) => (lab.portals = {})],
    ['нет staff', (lab: Record<string, unknown>) => delete lab.staff],
    ['time дробное', (lab: Record<string, unknown>) => (lab.time = 1.5)],
    ['time отрицательное', (lab: Record<string, unknown>) => (lab.time = -1)],
    ['worlds — массив', (lab: Record<string, unknown>) => (lab.worlds = [])],
    ['log не массив', (lab: Record<string, unknown>) => (lab.log = 'пусто')],
  ])('%s', (_name, change) => {
    expect(parseSave(withLab(change))).toBeNull()
  })
})

describe('parseSave: порталы, миры, штат, журнал', () => {
  // Сырой JSON лаборатории: поля ломаем напрямую, без типов домена
  type Change = (lab: Record<string, any>) => void

  it.each<[string, Change]>([
    ['статус портала неизвестен', (lab) => (lab.portals[0].status = 'exploded')],
    ['арка вне зала', (lab) => (lab.portals[0].arch = 12)],
    ['арка дробная', (lab) => (lab.portals[0].arch = 0.5)],
    ['энергия не конечна', (lab) => (lab.portals[0].energy = '50')],
    ['наблюдателей больше предела', (lab) => (lab.portals[0].observers = 4)],
    ['questioned без заметки', (lab) => (lab.portals[0].questioned = {})],
    ['acceptedAt неизвестный уровень', (lab) => (lab.portals[0].acceptedAt = 'extreme')],
    ['мира портала нет в worlds', (lab) => (lab.worlds = {})],
    ['у мира нет кода', (lab) => delete lab.worlds[lab.portals[0].world].code],
    ['у мира нет lastVisit', (lab) => delete lab.worlds[lab.portals[0].world].lastVisit],
    ['lastVisit дробное', (lab) => (lab.worlds[lab.portals[0].world].lastVisit = 1.5)],
    ['lastVisit отрицательное', (lab) => (lab.worlds[lab.portals[0].world].lastVisit = -1)],
    ['существ отрицательно', (lab) => (lab.worlds[lab.portals[0].world].creatures = -1)],
    ['штат: свободных дробно', (lab) => (lab.staff.free = 2.5)],
    ['штат: потерь нет', (lab) => delete lab.staff.lost],
    ['запись журнала: kind неизвестен', (lab) => (lab.log[0].kind = 'debug')],
    ['запись журнала: нет текста', (lab) => delete lab.log[0].text],
    ['запись журнала: portal число', (lab) => (lab.log[0].portal = 5)],
  ])('%s', (_name, change) => {
    expect(parseSave(withLab(change))).toBeNull()
  })

  it('пустая лаборатория сохраняется и читается', () => {
    const save = { lab: createLab(), rngState: 0 }

    expect(parseSave(serializeSave(save))).toEqual(save)
  })
})
