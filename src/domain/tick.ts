// Тик симуляции (docs/spec.md §4): чистая функция Lab → Lab + события.
import { CONFIG } from './config'
import type { Lab, Portal, Staff } from './lab'
import type { RiskLevel } from './risk'

// События тика: журнал по ним пишет advance (journal.ts), сам тик журнал не трогает
export type TickEvent =
  | { type: 'hireCompleted' }
  | { type: 'creatureStudied'; portal: string; world: string; studied: number; creatures: number }
  | { type: 'worldStudied'; world: string; creatures: number; returned: number }
  | { type: 'portalCollapsed'; portal: string; world: string; cause: 'time' | 'stability' }
  | { type: 'observersLost'; portal: string; world: string; count: number }
  | { type: 'riskLevelChanged'; portal: string; world: string; from: RiskLevel; to: RiskLevel }
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
  const staff = hire(lab.staff, events)
  const portals: Portal[] = []
  let lost = staff.lost
  for (const portal of lab.portals) {
    const degraded = degrade(portal)
    if (!isCollapsing(degraded)) {
      portals.push(degraded)
      continue
    }
    portals.push(collapse(degraded))
    events.push(...collapseEvents(degraded))
    lost += degraded.observers
  }
  return {
    lab: { ...lab, time: lab.time + 1, portals, staff: { ...staff, lost } },
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
