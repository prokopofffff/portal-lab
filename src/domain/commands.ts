// Команды смотрителя (docs/spec.md §5): (лаборатория, команда, ГСЧ) → новое состояние + события или отказ.
import { CONFIG } from './config'
import type { Lab, Portal, World } from './lab'
import type { Rng } from './rng'
import { WORLD_NAMES, portalName, worldCode } from './worlds'

export type Command = { type: 'openPortal' }

export type DomainEvent = {
  type: 'portalOpened'
  portal: string
  world: string
  firstVisit: boolean
}

export type CommandResult = { lab: Lab; events: DomainEvent[] } | { rejection: string }

export function execute(lab: Lab, command: Command, rng: Rng): CommandResult {
  switch (command.type) {
    case 'openPortal':
      return openPortal(lab, rng)
  }
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
