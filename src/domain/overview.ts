// Сводка лаборатории и список «Требуют внимания» (docs/spec.md §7).
import { CONFIG } from './config'
import type { Lab } from './lab'
import { assessRisk, RISK_LEVEL_LABELS, type RiskLevel } from './risk'

export interface Summary {
  open: number
  maxOpen: number
  // Открытые порталы с критическим уровнем риска
  critical: number
  closed: number
  collapsed: number
  // Известные миры
  worlds: number
  // Изучено и всего существ по всем мирам
  studied: number
  creatures: number
  staff: { free: number; onSite: number; inTransit: number; lost: number }
}

// Сводка по лаборатории (spec §7)
export function summarize(lab: Lab): Summary {
  const open = lab.portals.filter((p) => p.status === 'open')
  const worlds = Object.values(lab.worlds)
  return {
    open: open.length,
    maxOpen: CONFIG.maxOpenPortals,
    critical: open.filter((p) => assessRisk(p).level === 'critical').length,
    closed: lab.portals.filter((p) => p.status === 'closed').length,
    collapsed: lab.portals.filter((p) => p.status === 'collapsed').length,
    worlds: worlds.length,
    studied: worlds.reduce((sum, w) => sum + w.studied, 0),
    creatures: worlds.reduce((sum, w) => sum + w.creatures, 0),
    staff: {
      free: lab.staff.free,
      onSite: open.reduce((sum, p) => sum + p.observers, 0),
      inTransit: lab.staff.hireTicksLeft > 0 ? 1 : 0,
      lost: lab.staff.lost,
    },
  }
}

export interface AttentionItem {
  portal: string
  world: string
  level: RiskLevel
  reason: string
}

// «наблюдатель» / «наблюдателя» / «наблюдателей» по числу
function observersNoun(n: number): string {
  const lastTwo = n % 100
  const last = n % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'наблюдателей'
  if (last === 1) return 'наблюдатель'
  if (last >= 2 && last <= 4) return 'наблюдателя'
  return 'наблюдателей'
}

// Чем больше, тем опаснее (spec §3)
const LEVEL_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 }

// Порталы, требующие внимания (spec §7): открытые, кроме принятых как есть;
// уровень риска ↓, время до схлопывания ↑, неизученные существа мира ↓ (сортировка устойчива)
export function attentionList(lab: Lab): AttentionItem[] {
  return lab.portals
    .filter((p) => p.status === 'open' && p.acceptedAt === null)
    .map((portal) => {
      // Открытый портал всегда ведёт в известный лаборатории мир
      const world = lab.worlds[portal.world]!
      return {
        portal,
        level: assessRisk(portal).level,
        unstudied: world.creatures - world.studied,
      }
    })
    .sort(
      (a, b) =>
        LEVEL_RANK[b.level] - LEVEL_RANK[a.level] ||
        a.portal.timeLeft - b.portal.timeLeft ||
        b.unstudied - a.unstudied,
    )
    .slice(0, CONFIG.attentionLimit)
    .map(({ portal, level, unstudied }) => {
      const parts = [RISK_LEVEL_LABELS[level], `схлопнется через ${Math.ceil(portal.timeLeft)} мин`]
      if (unstudied > 0) parts.push(`не изучено ${unstudied}`)
      if (portal.observers > 0) {
        parts.push(`на месте ${portal.observers} ${observersNoun(portal.observers)}`)
      }
      return { portal: portal.name, world: portal.world, level, reason: parts.join(' · ') }
    })
}
