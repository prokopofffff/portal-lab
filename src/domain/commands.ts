// Команды смотрителя (docs/spec.md §5): (лаборатория, команда, ГСЧ) → новое состояние + события или отказ.
import { CONFIG } from './config'
import { createLab, type Lab, type Portal, type World } from './lab'
import { observersNoun } from './plural'
import type { Rng } from './rng'
import { assessRisk, type RiskLevel } from './risk'
import { riskLevelChange, type RiskLevelChanged } from './tick'
import { WORLD_NAMES, portalName, worldCode } from './worlds'

export type Command =
  | { type: 'openPortal' }
  | { type: 'sealLab' }
  | { type: 'stabilize'; portal: string }
  | { type: 'sendObserver'; portal: string }
  | { type: 'recallObservers'; portal: string }
  | { type: 'hireObserver' }
  | { type: 'closePortal'; portal: string }
  | { type: 'cancelClose'; portal: string }
  | { type: 'toggleQuestioned'; portal: string; note?: string }
  | { type: 'acceptAsIs'; portal: string }

export type DomainEvent =
  | { type: 'portalOpened'; portal: string; world: string; firstVisit: boolean }
  | {
      type: 'portalStabilized'
      portal: string
      world: string
      scoreFrom: number
      scoreTo: number
    }
  | { type: 'observerSent'; portal: string; world: string; onSite: number }
  | { type: 'observersRecalled'; portal: string; world: string; count: number }
  | { type: 'hireStarted'; ticks: number }
  | {
      type: 'portalClosed'
      portal: string
      world: string
      leftUnstudied: { unstudied: number; creatures: number } | null
    }
  | { type: 'closeCancelled'; portal: string; world: string }
  | { type: 'questionedMarked'; portal: string; world: string; note: string }
  | { type: 'questionedUnmarked'; portal: string; world: string }
  | { type: 'portalAccepted'; portal: string; world: string; level: RiskLevel }
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
    case 'sendObserver':
      return sendObserver(lab, command.portal)
    case 'recallObservers':
      return recallObservers(lab, command.portal)
    case 'hireObserver':
      return hireObserver(lab)
    case 'closePortal':
      return closePortal(lab, command.portal)
    case 'cancelClose':
      return cancelClose(lab, command.portal)
    case 'toggleQuestioned':
      return toggleQuestioned(lab, command.portal, command.note)
    case 'acceptAsIs':
      return acceptAsIs(lab, command.portal)
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
    ? { ...known, visits: known.visits + 1, lastVisit: lab.time }
    : {
        name: worldName,
        code: worldCode(worldName),
        creatures: rng.int(spawn.worldCreatures.min, spawn.worldCreatures.max),
        studied: 0,
        visits: 1,
        lastVisit: lab.time,
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

// Отказ в стабилизации (spec §5) или null, если она доступна: перезарядка или слишком высокая стабильность
export function stabilizeRejection(portal: Portal): string | null {
  const { forbiddenFromStability } = CONFIG.stabilize
  if (portal.cooldown > 0) return `Кулдаун стабилизации — осталось ${portal.cooldown} мин`
  if (portal.stability >= forbiddenFromStability) {
    return `Стабильность ${forbiddenFromStability}% или выше — стабилизация запрещена`
  }
  return null
}

// Стабилизация (spec §5): рывок стабильности и времени за энергию, затем перезарядка
function stabilize(lab: Lab, name: string): CommandResult {
  const portal = resolveOpenPortal(lab, name)
  if ('rejection' in portal) return portal

  const { stabilityGain, energyCost, timeGain, cooldownTicks } = CONFIG.stabilize
  const { bounds } = CONFIG
  const rejection = stabilizeRejection(portal)
  if (rejection !== null) return { rejection }
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

// Отправка наблюдателя на портал (spec §5): свободный сотрудник становится наблюдателем на месте
function sendObserver(lab: Lab, name: string): CommandResult {
  const portal = resolveOpenPortal(lab, name)
  if ('rejection' in portal) return portal

  if (assessRisk(portal).level === 'critical') {
    return { rejection: 'Риск критический — наблюдателей не отправляют' }
  }
  // Открытый портал всегда ведёт в известный лаборатории мир
  const world = lab.worlds[portal.world]!
  if (world.creatures === 0) return { rejection: 'Нечего изучать: в мире нет существ' }
  if (world.studied >= world.creatures) {
    return { rejection: 'Нечего изучать: все существа мира изучены' }
  }
  const { maxObserversPerPortal } = CONFIG
  if (portal.observers >= maxObserversPerPortal) {
    return {
      rejection: `На месте уже ${maxObserversPerPortal} ${observersNoun(maxObserversPerPortal)}`,
    }
  }
  if (lab.staff.free === 0) return { rejection: 'Нет свободных наблюдателей' }
  const sent: Portal = { ...portal, observers: portal.observers + 1 }
  return {
    lab: { ...withPortal(lab, sent), staff: { ...lab.staff, free: lab.staff.free - 1 } },
    events: [
      { type: 'observerSent', portal: portal.name, world: portal.world, onSite: sent.observers },
    ],
  }
}

// Отзыв наблюдателей с портала (spec §5): они свободны, прогресс текущего существа теряется
function recallObservers(lab: Lab, name: string): CommandResult {
  const portal = resolveOpenPortal(lab, name)
  if ('rejection' in portal) return portal

  if (portal.observers === 0) return { rejection: 'На месте никого нет' }
  const recalled: Portal = { ...portal, observers: 0, studyProgress: 0 }
  return {
    lab: {
      ...withPortal(lab, recalled),
      staff: { ...lab.staff, free: lab.staff.free + portal.observers },
    },
    events: [
      {
        type: 'observersRecalled',
        portal: portal.name,
        world: portal.world,
        count: portal.observers,
      },
    ],
  }
}

// Штат (spec §2.3): свободные, наблюдатели на открытых порталах и сотрудник, которого нанимают
function staffTotal(lab: Lab): number {
  const onSite = lab.portals
    .filter((p) => p.status === 'open')
    .reduce((sum, p) => sum + p.observers, 0)
  return lab.staff.free + onSite + (lab.staff.hireTicksLeft > 0 ? 1 : 0)
}

// Наём наблюдателя (spec §5): сотрудник станет свободным через CONFIG.hire.ticks тиков (см. tick)
function hireObserver(lab: Lab): CommandResult {
  const { staff, hire } = CONFIG
  const total = staffTotal(lab)
  if (total >= staff.max) {
    const inTransit = lab.staff.hireTicksLeft > 0 ? ', включая наём в пути' : ''
    return { rejection: `Штат полон: ${total} из ${staff.max}${inTransit}` }
  }
  if (lab.staff.hireTicksLeft > 0) {
    return { rejection: `Наём уже идёт — осталось ${lab.staff.hireTicksLeft} мин` }
  }
  return {
    lab: { ...lab, staff: { ...lab.staff, hireTicksLeft: hire.ticks } },
    events: [{ type: 'hireStarted', ticks: hire.ticks }],
  }
}

// Закрытие портала (spec §5): метрики остаются последними, пометки и прогресс изучения сбрасываются
function closePortal(lab: Lab, name: string): CommandResult {
  const portal = resolveOpenPortal(lab, name)
  if ('rejection' in portal) return portal

  if (portal.observers > 0) return { rejection: 'На месте наблюдатели — сначала отзовите' }
  const confirmation = closeConfirmation(lab, name)
  const closed: Portal = {
    ...portal,
    status: 'closed',
    questioned: null,
    acceptedAt: null,
    studyProgress: 0,
  }
  // Без диалога подтверждения (всё изучено) ничего не осталось; `world` из подтверждения не нужен
  const leftUnstudied = confirmation
    ? { unstudied: confirmation.unstudied, creatures: confirmation.creatures }
    : null
  return {
    lab: withPortal(lab, closed),
    events: [{ type: 'portalClosed', portal: portal.name, world: portal.world, leftUnstudied }],
  }
}

// Отмена закрытия (spec §5): состояние не меняется, остаётся запись в журнале
function cancelClose(lab: Lab, name: string): CommandResult {
  const portal = resolveOpenPortal(lab, name)
  if ('rejection' in portal) return portal

  return { lab, events: [{ type: 'closeCancelled', portal: portal.name, world: portal.world }] }
}

// Пометка «Под вопросом» (spec §5): ставится с заметкой, повторный вызов снимает
function toggleQuestioned(lab: Lab, name: string, note?: string): CommandResult {
  const portal = resolveOpenPortal(lab, name)
  if ('rejection' in portal) return portal

  const { world } = portal
  if (portal.questioned) {
    return {
      lab: withPortal(lab, { ...portal, questioned: null }),
      events: [{ type: 'questionedUnmarked', portal: portal.name, world }],
    }
  }
  const trimmed = note?.trim() ?? ''
  return {
    lab: withPortal(lab, { ...portal, questioned: { note: trimmed } }),
    events: [{ type: 'questionedMarked', portal: portal.name, world, note: trimmed }],
  }
}

// «Принять как есть» (spec §5): запоминает уровень риска; тик снимает принятие, когда уровень вырастет
function acceptAsIs(lab: Lab, name: string): CommandResult {
  const portal = resolveOpenPortal(lab, name)
  if ('rejection' in portal) return portal

  const { level } = assessRisk(portal)
  if (level === 'critical') return { rejection: 'Риск критический — принять как есть нельзя' }
  if (portal.acceptedAt !== null) return { rejection: 'Портал уже принят как есть' }
  return {
    lab: withPortal(lab, { ...portal, acceptedAt: level }),
    events: [{ type: 'portalAccepted', portal: portal.name, world: portal.world, level }],
  }
}

// Сводка для диалога закрытия (spec §5): есть, только если закрытие оставит неизученных существ без прохода
export function closeConfirmation(
  lab: Lab,
  name: string,
): { world: string; unstudied: number; creatures: number } | null {
  const portal = resolveOpenPortal(lab, name)
  if ('rejection' in portal) return null

  // Открытый портал всегда ведёт в известный лаборатории мир
  const { creatures, studied } = lab.worlds[portal.world]!
  const unstudied = creatures - studied
  const otherOpenToWorld = lab.portals.some(
    (p) => p.name !== portal.name && p.status === 'open' && p.world === portal.world,
  )
  if (unstudied <= 0 || otherOpenToWorld) return null
  return { world: portal.world, unstudied, creatures }
}
