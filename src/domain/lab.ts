// Модель лаборатории (docs/spec.md §2). Состояние неизменяемо: команды возвращают новое.
import { CONFIG } from './config'
import type { RiskLevel } from './risk'

export type PortalStatus = 'open' | 'closed' | 'collapsed'

// Мир назначения (spec §2.1): появляется при первом открытии портала и не исчезает
export interface World {
  name: string
  code: string
  creatures: number
  studied: number
  visits: number
  // Время симуляции последнего открытия портала в этот мир (spec §9, атлас)
  lastVisit: number
}

// Портал — один проход в мир (spec §2.2)
export interface Portal {
  name: string
  world: string
  status: PortalStatus
  // Арка зала 0–11: первая свободная при открытии, не меняется до закрытия (spec §9)
  arch: number
  energy: number
  stability: number
  timeLeft: number
  observers: number
  studyProgress: number
  cooldown: number
  questioned: { note: string } | null
  // Уровень риска на момент «Принять как есть»; null — не принят
  acceptedAt: RiskLevel | null
}

export type LogKind = 'action' | 'rejection' | 'system'

// Запись журнала (spec §8)
export interface LogEntry {
  time: number
  realTime: number
  portal: string | null
  world: string | null
  kind: LogKind
  text: string
}

// Штат: на месте считается по порталам, в пути — это идущий наём (spec §2.3)
export interface Staff {
  free: number
  hireTicksLeft: number
  lost: number
}

export interface Lab {
  time: number
  portals: Portal[]
  // Ключ — имя мира в именительном падеже
  worlds: Record<string, World>
  staff: Staff
  log: LogEntry[]
}

export function createLab(): Lab {
  return {
    time: 0,
    portals: [],
    worlds: {},
    staff: { free: CONFIG.staff.initial, hireTicksLeft: 0, lost: 0 },
    log: [],
  }
}
