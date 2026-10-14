// Команды смотрителя (docs/spec.md §5): (лаборатория, команда, ГСЧ) → новое состояние + события или отказ.
import { CONFIG } from './config'
import { createLab, type Lab, type Portal, type World } from './lab'
import type { Rng } from './rng'
import { assessRisk } from './risk'
import { riskLevelChange, type RiskLevelChanged } from './tick'
import { WORLD_NAMES, portalName, worldCode } from './worlds'

export type Command =
  { type: 'openPortal' } | { type: 'sealLab' } | { type: 'stabilize'; portal: string }

export type DomainEvent =
  | { type: 'portalOpened'; portal: string; world: string; firstVisit: boolean }
  | {
      type: 'portalStabilized'
      portal: string
      world: string
      scoreFrom: number
      scoreTo: number
    }
  | RiskLevelChanged

export type CommandResult = { lab: Lab; events: DomainEvent[] } | { rejection: string }

export function execute(lab: Lab, command: Command, rng: Rng): CommandResult {
  switch (command.type) {
    case 'openPortal':
      return openPortal(lab, rng)
    case 'sealLab':
      return { lab: createLab(), events: [] }
    case 'stabilize':
      return stabilize(lab, command.portal)
  }
}

// Открытый портал по имени или общий отказ «Портал не открыт» — такого нет или он уже не открыт
function resolveOpenPortal(lab: Lab, name: string): Portal | { rejection: string } {
  const portal = lab.portals.find((p) => p.name === name)
  return portal?.status === 'open' ? portal : { rejection: 'Портал не открыт' }
}

// Лаборатория, в которой портал с тем же именем заменён на новый
function withPortal(lab: Lab, portal: Portal): Lab {
  return { ...lab, portals: lab.portals.map((p) => (p.name === portal.name ? portal : p)) }
}

// Первая арка 0–11, не занятая открытым порталом; -1 — все заняты
function firstFreeArch(lab: Lab): number {
  const taken = new Set(lab.portals.filter((p) => p.status === 'open').map((p) => p.arch))
  for (let arch = 0; arch < CONFIG.maxOpenPortals; arch++) {
    if (!taken.has(arch)) return arch
  }
  return -1
}

function openPortal(lab: Lab, rng: Rng): CommandResult {
  const { spawn, maxOpenPortals } = CONFIG
  const arch = firstFreeArch(lab)
  if (arch === -1) {
    return {
      rejection: `Открыто ${maxOpenPortals} порталов из ${maxOpenPortals} — все арки заняты`,
    }
  }

  const worldName = rng.pick(WORLD_NAMES)
  const energy = rng.int(spawn.energy.min, spawn.energy.max)
  const stability = rng.int(spawn.stability.min, spawn.stability.max)
  const timeLeft = rng.int(spawn.timeLeft.min, spawn.timeLeft.max)

  // Известный мир — новое посещение: существа и изученные не меняются (spec §2.1)
  const known = lab.worlds[worldName]
  const world: World = known
    ? { ...known, visits: known.visits + 1 }
    : {
        name: worldName,
        code: worldCode(worldName),
        creatures: rng.int(spawn.worldCreatures.min, spawn.worldCreatures.max),
        studied: 0,
        visits: 1,
      }

  const portal: Portal = {
    name: portalName(worldName, world.visits),
    world: worldName,
    status: 'open',
    arch,
    energy,
    stability,
    timeLeft,
    observers: 0,
    studyProgress: 0,
    cooldown: 0,
    questioned: null,
    acceptedAt: null,
  }

  return {
    lab: {
      ...lab,
      portals: [...lab.portals, portal],
      worlds: { ...lab.worlds, [worldName]: world },
    },
    events: [{ type: 'portalOpened', portal: portal.name, world: worldName, firstVisit: !known }],
  }
}

// Стабилизация (spec §5): рывок стабильности и времени за энергию, затем перезарядка
function stabilize(lab: Lab, name: string): CommandResult {
  const portal = resolveOpenPortal(lab, name)
  if ('rejection' in portal) return portal

  const { stabilityGain, energyCost, timeGain, cooldownTicks, forbiddenFromStability } =
    CONFIG.stabilize
  const { bounds } = CONFIG
  if (portal.cooldown > 0) {
    return { rejection: `Кулдаун стабилизации — осталось ${portal.cooldown} мин` }
  }
  if (portal.stability >= forbiddenFromStability) {
    return {
      rejection: `Стабильность ${forbiddenFromStability}% или выше — стабилизировать не нужно`,
    }
  }
  const stabilized: Portal = {
    ...portal,
    stability: Math.min(bounds.stability.max, portal.stability + stabilityGain),
    energy: Math.max(bounds.energy.min, portal.energy - energyCost),
    timeLeft: portal.timeLeft + timeGain,
    cooldown: cooldownTicks,
  }
  const stabilizedEvent: DomainEvent = {
    type: 'portalStabilized',
    portal: portal.name,
    world: portal.world,
    scoreFrom: assessRisk(portal).score,
    scoreTo: assessRisk(stabilized).score,
  }
  const levelChange = riskLevelChange(portal, stabilized)
  return {
    lab: withPortal(lab, stabilized),
    events: levelChange ? [stabilizedEvent, levelChange] : [stabilizedEvent],
  }
}
