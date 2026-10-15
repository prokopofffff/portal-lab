// Двенадцать арок зала из лаборатории (docs/spec.md §9): что стоит в каждой арке и что написано на табличке
import {
  assessRisk,
  CONFIG,
  worldStats,
  type Lab,
  type Portal,
  type RiskLevel,
} from '../../domain'

export const ARCH_COUNT = CONFIG.maxOpenPortals

/** Открытый портал в арке: всё, что показывает табличка. */
export interface PortalCell {
  kind: 'portal'
  arch: number
  name: string
  world: string
  // В тот же мир открыт ещё портал
  shared: boolean
  level: RiskLevel
  score: number
  observers: number
  questioned: boolean
  accepted: boolean
  energy: number
  stability: number
  timeLeft: number
  // Доля полоски ВРМ, %: от самого долгого времени нового портала
  timePct: number
  studied: number
  creatures: number
  // Полоска изучения: изучено и участок следующего существа, % ширины
  doneW: number
  nextW: number
  nextPct: number
}

export interface EmptyCell {
  kind: 'empty'
  arch: number
}

export type HallCell = PortalCell | EmptyCell

/** Портал, который только что ушёл из арки: последняя табличка и чем кончился. */
export interface Departure {
  cell: PortalCell
  status: 'closed' | 'collapsed'
}

function portalCell(lab: Lab, portal: Portal, shared: boolean): PortalCell {
  const risk = assessRisk(portal)
  const world = lab.worlds[portal.world]!
  const stats = worldStats(lab, world)
  return {
    kind: 'portal',
    arch: portal.arch,
    name: portal.name,
    world: portal.world,
    shared,
    level: risk.level,
    score: risk.score,
    observers: portal.observers,
    questioned: portal.questioned !== null,
    accepted: portal.acceptedAt !== null,
    energy: Math.round(portal.energy),
    stability: Math.round(portal.stability),
    timeLeft: Math.ceil(portal.timeLeft),
    timePct: Math.min(100, Math.round((portal.timeLeft / CONFIG.spawn.timeLeft.max) * 100)),
    studied: world.studied,
    creatures: world.creatures,
    doneW: stats.donePct,
    nextW: stats.nextBarPct,
    nextPct: stats.nextPct,
  }
}

function openPortalCells(lab: Lab): PortalCell[] {
  const open = lab.portals.filter((p) => p.status === 'open')
  const perWorld = new Map<string, number>()
  for (const p of open) perWorld.set(p.world, (perWorld.get(p.world) ?? 0) + 1)
  return open.map((p) => portalCell(lab, p, perWorld.get(p.world)! > 1))
}

/** Арки 1–12 по порядку: открытый портал стоит в своей арке, остальные пусты. */
export function hallCells(lab: Lab): HallCell[] {
  const cells: HallCell[] = Array.from({ length: ARCH_COUNT }, (_, arch) => ({
    kind: 'empty',
    arch,
  }))
  for (const cell of openPortalCells(lab)) cells[cell.arch] = cell
  return cells
}

/** Порталы, открытые в prev и закрытые или схлопнувшиеся в next, — с табличкой из prev. */
export function departures(prev: Lab, next: Lab): Departure[] {
  const ended = new Map<string, Departure['status']>()
  for (const p of next.portals) if (p.status !== 'open') ended.set(p.name, p.status)
  return openPortalCells(prev).flatMap((cell) => {
    const status = ended.get(cell.name)
    return status ? [{ cell, status }] : []
  })
}
