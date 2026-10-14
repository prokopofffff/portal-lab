// Рекомендуемое действие по порталу (docs/spec.md §6): первое подходящее правило из списка.
import { stabilizeRejection } from './commands'
import { CONFIG } from './config'
import type { Lab } from './lab'
import { assessRisk, RISK_LEVEL_LABELS } from './risk'

export interface Recommendation {
  action: 'recallObservers' | 'stabilize' | 'closePortal' | 'sendObserver' | 'acceptAsIs'
  reason: string
}

// Причина отказа с маленькой буквы, чтобы вставить её в середину фразы
function lowerFirst(text: string): string {
  return `${text[0]!.toLowerCase()}${text.slice(1)}`
}

// Рекомендация для открытого портала; null, если портала с таким именем нет или он не открыт
export function recommend(lab: Lab, name: string): Recommendation | null {
  const portal = lab.portals.find((p) => p.name === name)
  if (!portal || portal.status !== 'open') return null

  // Открытый портал всегда ведёт в известный лаборатории мир
  const world = lab.worlds[portal.world]!
  const unstudied = world.creatures - world.studied
  const level = assessRisk(portal).level
  const rejection = stabilizeRejection(portal)
  const max = CONFIG.maxObserversPerPortal

  if (level === 'critical' && portal.observers > 0) {
    return {
      action: 'recallObservers',
      reason: `Риск критический, на месте наблюдатели (${portal.observers}) — при схлопывании они будут потеряны`,
    }
  }
  if (level === 'critical' && rejection === null) {
    return {
      action: 'stabilize',
      reason: 'Риск критический — стабилизация поднимет стабильность и время до схлопывания',
    }
  }
  if (level === 'critical' && rejection !== null) {
    const leftPart =
      unstudied > 0
        ? `в мире останется не изучено ${unstudied} из ${world.creatures}`
        : 'в мире не осталось неизученных'
    return {
      action: 'closePortal',
      reason: `Риск критический, стабилизация недоступна (${lowerFirst(rejection)}) — ${leftPart}`,
    }
  }
  if (level === 'high' && rejection === null) {
    return { action: 'stabilize', reason: 'Риск высокий — стабилизация снизит его' }
  }
  if (unstudied > 0 && portal.observers < max && lab.staff.free > 0) {
    return {
      action: 'sendObserver',
      reason: `В мире не изучено ${unstudied} из ${world.creatures}, на месте ${portal.observers} из ${max} — отправьте наблюдателя`,
    }
  }
  if (unstudied === 0) {
    return {
      action: 'closePortal',
      reason:
        world.creatures > 0
          ? 'Все существа мира изучены — закрыть безопасно'
          : 'В мире нет существ — закрыть безопасно',
    }
  }
  // Остались неизученные существа, но отправлять некого: на месте предел или нет свободных
  const label = RISK_LEVEL_LABELS[level]
  if (portal.acceptedAt !== null) {
    return {
      action: 'acceptAsIs',
      reason: `Уже принят как есть, риск ${label} — оставить открытым`,
    }
  }
  return {
    action: 'acceptAsIs',
    reason:
      portal.observers >= max
        ? `Риск ${label}, на месте уже ${max} наблюдателя — можно оставить открытым`
        : `Риск ${label}, свободных наблюдателей нет — можно оставить открытым`,
  }
}
