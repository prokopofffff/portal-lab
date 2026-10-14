import { describe, expect, it } from 'vitest'
import { WORLD_NAMES, portalName, worldCode } from './worlds'

// Примеры из таблицы spec §2.4
const EXAMPLES = [
  { world: 'Пепельные Топи', code: 'ПТ-420' },
  { world: 'Багровая Бездна', code: 'ББ-310' },
  { world: 'Ледяные Чертоги', code: 'ЛЧ-244' },
  { world: 'Шепчущее Зеркало', code: 'ШЗ-793' },
  { world: 'Забытый Маяк', code: 'ЗМ-517' },
  { world: 'Янтарный Сад', code: 'ЯС-179' },
]

describe('worldCode', () => {
  it.each(EXAMPLES)('шифр мира «$world» — $code', ({ world, code }) => {
    expect(worldCode(world)).toBe(code)
  })
})

describe('portalName', () => {
  it('название портала — шифр мира и номер посещения', () => {
    expect(portalName('Пепельные Топи', 1)).toBe('ПТ-420-1')
    expect(portalName('Пепельные Топи', 2)).toBe('ПТ-420-2')
    expect(portalName('Пепельные Топи', 3)).toBe('ПТ-420-3')
    expect(portalName('Янтарный Сад', 2)).toBe('ЯС-179-2')
  })
})

describe('WORLD_NAMES', () => {
  it('содержит ровно 400 различных миров', () => {
    expect(WORLD_NAMES).toHaveLength(400)
    expect(new Set(WORLD_NAMES).size).toBe(400)
  })
})

// Существительные по родам, Приложение A (записаны независимо от кода)
const NOUNS_BY_GENDER = {
  м: {
    nouns: ['Шпиль', 'Колодец', 'Лабиринт', 'Курган', 'Сад', 'Маяк'],
    endings: ['ый', 'ий', 'ой'],
  },
  ж: { nouns: ['Бездна', 'Башня', 'Пещера', 'Чаща', 'Гавань'], endings: ['ая', 'яя'] },
  ср: { nouns: ['Око', 'Зеркало', 'Болото', 'Ущелье', 'Святилище'], endings: ['ое', 'ее'] },
  мн: { nouns: ['Топи', 'Чертоги', 'Катакомбы', 'Пустоши'], endings: ['ые', 'ие'] },
}

describe('согласование по роду', () => {
  it('прилагательное каждого из 400 миров согласовано с родом существительного', () => {
    const disagreeing: string[] = []
    let checked = 0
    for (const { nouns, endings } of Object.values(NOUNS_BY_GENDER)) {
      for (const noun of nouns) {
        const worlds = WORLD_NAMES.filter((name) => name.endsWith(` ${noun}`))
        expect(worlds).toHaveLength(20)
        for (const name of worlds) {
          const [adjective = ''] = name.split(' ')
          if (!endings.some((ending) => adjective.endsWith(ending))) disagreeing.push(name)
        }
        checked += worlds.length
      }
    }
    expect(checked).toBe(400)
    expect(disagreeing).toEqual([])
  })
})

describe('шифры миров', () => {
  it('все 400 шифров уникальны', () => {
    const byCode = new Map<string, string[]>()
    for (const name of WORLD_NAMES) {
      const code = worldCode(name)
      byCode.set(code, [...(byCode.get(code) ?? []), name])
    }
    const collisions = [...byCode].filter(([, names]) => names.length > 1)
    expect(
      collisions,
      collisions.map(([code, names]) => `${code}: ${names.join(', ')}`).join('; '),
    ).toEqual([])
  })

  it('шифр детерминирован', () => {
    for (const name of WORLD_NAMES) {
      expect(worldCode(name)).toBe(worldCode(name))
    }
  })

  it('названия порталов для разных пар (мир, посещение) не повторяются', () => {
    const visits = 5
    const names = WORLD_NAMES.flatMap((world) =>
      Array.from({ length: visits }, (_, i) => portalName(world, i + 1)),
    )
    expect(new Set(names).size).toBe(WORLD_NAMES.length * visits)
  })
})
