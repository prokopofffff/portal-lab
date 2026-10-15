import { describe, expect, it } from 'vitest'
import { creaturePct, worldStats } from './study'
import { createLab, type Lab, type Portal, type World } from './lab'

const WORLD: World = {
  name: 'Пепельные Топи',
  code: 'ПТ-420',
  creatures: 4,
  studied: 1,
  visits: 2,
  lastVisit: 0,
}

function portal(name: string, over: Partial<Portal> = {}): Portal {
  return {
    name,
    world: WORLD.name,
    status: 'open',
    arch: 0,
    energy: 40,
    stability: 80,
    timeLeft: 100,
    observers: 1,
    studyProgress: 0,
    cooldown: 0,
    questioned: null,
    acceptedAt: null,
    ...over,
  }
}

function lab(portals: Portal[], world: World = WORLD): Lab {
  return { ...createLab(), portals, worlds: { [world.name]: world } }
}

describe('creaturePct', () => {
  it('доля от 20 наблюдателе-тиков, с округлением', () => {
    expect(creaturePct(0)).toBe(0)
    expect(creaturePct(7)).toBe(35)
    expect(creaturePct(19)).toBe(95)
  })

  it('не доходит до 100: на 100 существо уже изучено', () => {
    expect(creaturePct(20)).toBe(99)
  })
})

describe('worldStats', () => {
  it('следующее существо — по лучшему из открытых порталов мира, архив не в счёт', () => {
    const stats = worldStats(
      lab([
        portal('ПТ-420-1', { studyProgress: 15, status: 'closed' }),
        portal('ПТ-420-2', { studyProgress: 5 }),
        portal('ПТ-420-3', { studyProgress: 9 }),
      ]),
      WORLD,
    )
    expect(stats).toEqual({ open: 2, full: false, donePct: 25, nextPct: 45, nextBarPct: 11.25 })
  })

  it('изученный мир: следующего существа нет', () => {
    const world = { ...WORLD, studied: 4 }
    const stats = worldStats(lab([portal('ПТ-420-1', { studyProgress: 9 })], world), world)
    expect(stats).toMatchObject({ full: true, donePct: 100, nextPct: 0, nextBarPct: 0 })
  })

  it('мир без существ не считается изученным', () => {
    const world = { ...WORLD, creatures: 0, studied: 0 }
    expect(worldStats(lab([], world), world)).toMatchObject({
      full: false,
      donePct: 0,
      nextBarPct: 0,
    })
  })
})
