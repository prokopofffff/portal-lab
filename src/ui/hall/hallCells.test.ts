import { describe, expect, it } from 'vitest'
import { labWith, portal, world } from '../../test/labFixtures'
import { departures, hallCells, type PortalCell } from './hallCells'

const TOPI = 'Пепельные Топи'
const ZERK = 'Шепчущее Зеркало'
const worlds = {
  [TOPI]: world(TOPI, 'ПТ-420', { creatures: 9, studied: 3 }),
  [ZERK]: world(ZERK, 'ШЗ-793', { creatures: 2, studied: 2 }),
}

describe('hallCells', () => {
  it('пустая лаборатория: 12 пустых арок по порядку', () => {
    const cells = hallCells(labWith({ worlds: {} }))
    expect(cells).toHaveLength(12)
    expect(cells.every((c, i) => c.kind === 'empty' && c.arch === i)).toBe(true)
  })

  it('портал стоит в своей арке; закрытые и схлопнувшиеся арку не занимают', () => {
    const cells = hallCells(
      labWith({
        worlds,
        portals: [
          portal('ПТ-420-1', TOPI, { status: 'collapsed', arch: 0 }),
          portal('ПТ-420-2', TOPI, { arch: 4 }),
          portal('ШЗ-793-1', ZERK, { status: 'closed', arch: 1 }),
        ],
      }),
    )
    expect(cells.map((c) => c.kind)).toEqual([
      'empty',
      'empty',
      'empty',
      'empty',
      'portal',
      ...Array(7).fill('empty'),
    ])
    expect((cells[4] as PortalCell).name).toBe('ПТ-420-2')
  })

  it('табличка: метрики, риск, существа мира, пометки (канвас 00-hall, ПТ-420-1)', () => {
    const [cell] = hallCells(
      labWith({
        worlds,
        portals: [
          portal('ПТ-420-1', TOPI, {
            energy: 82.4,
            stability: 13.6,
            timeLeft: 7.2,
            observers: 2,
            studyProgress: 12,
            questioned: { note: '' },
          }),
        ],
      }),
    ) as PortalCell[]
    expect(cell).toMatchObject({
      name: 'ПТ-420-1',
      world: TOPI,
      shared: false,
      level: 'critical',
      observers: 2,
      questioned: true,
      accepted: false,
      energy: 82,
      stability: 14,
      timeLeft: 8,
      timePct: 2,
      studied: 3,
      creatures: 9,
      doneW: 33,
      nextPct: 60,
    })
    expect(cell!.nextW).toBeCloseTo(60 / 9)
  })

  it('«общий мир» — только когда в мир открыт ещё портал', () => {
    const lab = labWith({
      worlds,
      portals: [
        portal('ПТ-420-1', TOPI, { arch: 0 }),
        portal('ПТ-420-2', TOPI, { arch: 1 }),
        portal('ШЗ-793-1', ZERK, { arch: 2, acceptedAt: 'low' }),
        portal('ШЗ-793-2', ZERK, { arch: 3, status: 'closed' }),
      ],
    })
    const cells = hallCells(lab) as PortalCell[]
    expect(cells.slice(0, 3).map((c) => c.shared)).toEqual([true, true, false])
    expect(cells[2]!.accepted).toBe(true)
  })

  it('время дольше нового портала — полоска ВРМ полная', () => {
    const [cell] = hallCells(
      labWith({ worlds, portals: [portal('ПТ-420-1', TOPI, { timeLeft: 520 })] }),
    ) as PortalCell[]
    expect(cell!.timePct).toBe(100)
  })
})

describe('departures', () => {
  const open = portal('ПТ-420-1', TOPI, { arch: 3, stability: 40 })
  const prev = labWith({ worlds, portals: [open, portal('ШЗ-793-1', ZERK, { arch: 5 })] })

  it('портал закрылся или схлопнулся — табличка из прежнего состояния', () => {
    const next = labWith({
      worlds,
      portals: [
        { ...open, status: 'collapsed', stability: 0 },
        portal('ШЗ-793-1', ZERK, { arch: 5, status: 'closed' }),
      ],
    })
    const gone = departures(prev, next)
    expect(gone.map((d) => [d.cell.name, d.cell.arch, d.status])).toEqual([
      ['ПТ-420-1', 3, 'collapsed'],
      ['ШЗ-793-1', 5, 'closed'],
    ])
    expect(gone[0]!.cell.stability).toBe(40)
  })

  it('ничего не ушло — пусто; печать лаборатории — тоже пусто', () => {
    expect(departures(prev, prev)).toEqual([])
    expect(departures(prev, labWith({ worlds: {} }))).toEqual([])
  })
})
