// Тик симуляции (docs/spec.md §4): чистая функция Lab → Lab + события.
import { CONFIG } from './config'
import type { Lab, Portal, Staff, World } from './lab'
import { assessRisk, type RiskLevel } from './risk'

// Смена уровня риска открытого портала: бывает и в тике, и от команды (стабилизация)
export type RiskLevelChanged = {
  type: 'riskLevelChanged'
  portal: string
  world: string
  from: RiskLevel
  to: RiskLevel
}

// События тика: журнал по ним пишет advance (journal.ts), сам тик журнал не трогает
export type TickEvent =
  | { type: 'hireCompleted' }
  | { type: 'creatureStudied'; portal: string; world: string; studied: number; creatures: number }
  | { type: 'worldStudied'; world: string; creatures: number; returned: number }
  | { type: 'portalCollapsed'; portal: string; world: string; cause: 'time' | 'stability' }
  | { type: 'observersLost'; portal: string; world: string; count: number }
  | RiskLevelChanged
  | {
      type: 'acceptanceRevoked'
      portal: string
      world: string
      acceptedAt: RiskLevel
      level: RiskLevel
    }

export interface TickResult {
  lab: Lab
  events: TickEvent[]
}

// Один тик симуляции (spec §4). Журнал не трогает — это делает advance в journal.ts
export function tick(lab: Lab): TickResult {
  const events: TickEvent[] = []
  const hired = hire(lab.staff, events)
  const studying = study(lab.portals, lab.worlds, events)
  const staff = { ...hired, free: hired.free + studying.returned }
  const portals: Portal[] = []
  let lost = staff.lost
  for (const portal of studying.portals) {
    const degraded = degrade(portal)
    if (!isCollapsing(degraded)) {
      portals.push(degraded)
      continue
    }
    portals.push(collapse(degraded))
    events.push(...collapseEvents(degraded))
    lost += degraded.observers
  }
  const assessed = portals.map((portal, index) => reassess(lab.portals[index]!, portal, events))
  return {
    lab: {
      ...lab,
      time: lab.time + 1,
      portals: assessed,
      worlds: studying.worlds,
      staff: { ...staff, lost },
    },
    events,
  }
}

// Шаг 1: идущий наём приближается к концу, по окончании сотрудник становится свободным
function hire(staff: Staff, events: TickEvent[]): Staff {
  if (staff.hireTicksLeft <= 0) return staff
  const hireTicksLeft = staff.hireTicksLeft - 1
  if (hireTicksLeft > 0) return { ...staff, hireTicksLeft }
  events.push({ type: 'hireCompleted' })
  return { ...staff, free: staff.free + 1, hireTicksLeft }
}

// Шаг 2: наблюдатели изучают мир; прогресс идёт по порталам в порядке массива
function study(
  portals: Portal[],
  worlds: Record<string, World>,
  events: TickEvent[],
): { portals: Portal[]; worlds: Record<string, World>; returned: number } {
  const { observerTicksPerCreature } = CONFIG.study
  const nextPortals = [...portals]
  const nextWorlds = { ...worlds }
  let returned = 0
  nextPortals.forEach((portal, index) => {
    const world = nextWorlds[portal.world]
    if (portal.status !== 'open' || portal.observers <= 0) return
    if (!world || world.studied >= world.creatures) return
    let studyProgress = portal.studyProgress + portal.observers
    if (studyProgress < observerTicksPerCreature) {
      nextPortals[index] = { ...portal, studyProgress }
      return
    }
    studyProgress -= observerTicksPerCreature
    const studied = world.studied + 1
    nextPortals[index] = { ...portal, studyProgress }
    nextWorlds[portal.world] = { ...world, studied }
    events.push({
      type: 'creatureStudied',
      portal: portal.name,
      world: portal.world,
      studied,
      creatures: world.creatures,
    })
    if (studied < world.creatures) return
    // Мир изучен: наблюдатели всех открытых порталов к нему возвращаются
    let worldReturned = 0
    nextPortals.forEach((other, otherIndex) => {
      if (other.status !== 'open' || other.world !== portal.world) return
      worldReturned += other.observers
      nextPortals[otherIndex] = { ...other, observers: 0, studyProgress: 0 }
    })
    returned += worldReturned
    events.push({
      type: 'worldStudied',
      world: portal.world,
      creatures: world.creatures,
      returned: worldReturned,
    })
  })
  return { portals: nextPortals, worlds: nextWorlds, returned }
}

// Шаг 3: открытый портал теряет стабильность (вдвое медленнее при наблюдателях), время и перезарядку
function degrade(portal: Portal): Portal {
  if (portal.status !== 'open') return portal
  const { energyDivisor, observerFactor } = CONFIG.degradation
  const factor = portal.observers > 0 ? observerFactor : 1
  return {
    ...portal,
    stability: Math.max(0, portal.stability - (portal.energy / energyDivisor) * factor),
    timeLeft: Math.max(0, portal.timeLeft - 1),
    cooldown: Math.max(0, portal.cooldown - 1),
  }
}

// Шаг 4: открытый портал без времени или стабильности обрушивается
function isCollapsing(portal: Portal): boolean {
  return portal.status === 'open' && (portal.timeLeft <= 0 || portal.stability <= 0)
}

// Наблюдатели на месте теряются; остальные метрики сохраняют последние значения
function collapse(portal: Portal): Portal {
  return {
    ...portal,
    status: 'collapsed',
    observers: 0,
    studyProgress: 0,
    questioned: null,
    acceptedAt: null,
  }
}

function collapseEvents(portal: Portal): TickEvent[] {
  const { name, world, observers } = portal
  const collapsed: TickEvent = {
    type: 'portalCollapsed',
    portal: name,
    world,
    cause: portal.timeLeft <= 0 ? 'time' : 'stability',
  }
  return observers > 0
    ? [collapsed, { type: 'observersLost', portal: name, world, count: observers }]
    : [collapsed]
}

// Порядок уровней риска: чем больше число, тем выше уровень
const LEVEL_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 }

// Событие смены уровня риска у портала, открытого до и после изменения; null — уровень тот же
export function riskLevelChange(before: Portal, after: Portal): RiskLevelChanged | null {
  if (before.status !== 'open' || after.status !== 'open') return null
  const from = assessRisk(before).level
  const to = assessRisk(after).level
  if (from === to) return null
  return { type: 'riskLevelChanged', portal: after.name, world: after.world, from, to }
}

// Шаг 5: открытый до и после тика портал — событие при смене уровня; принятие снимается при росте выше него
function reassess(before: Portal, after: Portal, events: TickEvent[]): Portal {
  if (before.status !== 'open' || after.status !== 'open') return after
  const change = riskLevelChange(before, after)
  if (change) events.push(change)
  const { name: portal, world } = after
  const to = assessRisk(after).level
  const { acceptedAt } = after
  if (acceptedAt === null || LEVEL_RANK[to] <= LEVEL_RANK[acceptedAt]) return after
  events.push({ type: 'acceptanceRevoked', portal, world, acceptedAt, level: to })
  return { ...after, acceptedAt: null }
}
