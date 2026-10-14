// Формат сохранения (docs/spec.md §1, §10): лаборатория + состояние ГСЧ в JSON.
import { CONFIG } from './config'
import type { Lab, LogEntry, LogKind, Portal, PortalStatus, Staff, World } from './lab'
import type { RiskLevel } from './risk'

// Версия схемы сохранения: поднимать при любом изменении формы Lab/Portal
// и одновременно обновлять проверки (isPortal, isLab и др.)
export const SAVE_VERSION = 1

export interface SavedGame {
  lab: Lab
  rngState: number
}

const UINT32_MAX = 4294967295

const STATUSES: readonly PortalStatus[] = ['open', 'closed', 'collapsed']
const LOG_KINDS: readonly LogKind[] = ['action', 'rejection', 'system']
const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high', 'critical']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function isNonNegativeInteger(value: unknown): value is number {
  return isIntegerInRange(value, 0, Number.MAX_SAFE_INTEGER)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

// Состояние mulberry32 — uint32; дробное или NaN молча продолжило бы другую последовательность
function isUint32(value: unknown): value is number {
  return isIntegerInRange(value, 0, UINT32_MAX)
}

function isPortal(value: unknown): value is Portal {
  if (!isRecord(value)) return false
  return (
    typeof value.name === 'string' &&
    typeof value.world === 'string' &&
    isOneOf(value.status, STATUSES) &&
    isIntegerInRange(value.arch, 0, CONFIG.maxOpenPortals - 1) &&
    isFiniteNumber(value.energy) &&
    isFiniteNumber(value.stability) &&
    isFiniteNumber(value.timeLeft) &&
    isFiniteNumber(value.studyProgress) &&
    isFiniteNumber(value.cooldown) &&
    isIntegerInRange(value.observers, 0, CONFIG.maxObserversPerPortal) &&
    (value.questioned === null ||
      (isRecord(value.questioned) && typeof value.questioned.note === 'string')) &&
    (value.acceptedAt === null || isOneOf(value.acceptedAt, RISK_LEVELS))
  )
}

function isWorld(value: unknown): value is World {
  if (!isRecord(value)) return false
  return (
    typeof value.name === 'string' &&
    typeof value.code === 'string' &&
    isNonNegativeInteger(value.creatures) &&
    isNonNegativeInteger(value.studied) &&
    isNonNegativeInteger(value.visits)
  )
}

function isStaff(value: unknown): value is Staff {
  if (!isRecord(value)) return false
  return (
    isNonNegativeInteger(value.free) &&
    isNonNegativeInteger(value.hireTicksLeft) &&
    isNonNegativeInteger(value.lost)
  )
}

function isLogEntry(value: unknown): value is LogEntry {
  if (!isRecord(value)) return false
  return (
    isFiniteNumber(value.time) &&
    isFiniteNumber(value.realTime) &&
    isStringOrNull(value.portal) &&
    isStringOrNull(value.world) &&
    isOneOf(value.kind, LOG_KINDS) &&
    typeof value.text === 'string'
  )
}

function isLab(value: unknown): value is Lab {
  if (!isRecord(value)) return false
  const { time, portals, worlds, staff, log } = value
  if (!isNonNegativeInteger(time)) return false
  if (!isRecord(worlds) || !Object.values(worlds).every(isWorld)) return false
  if (!Array.isArray(portals) || !portals.every(isPortal)) return false
  // Портал ссылается на мир по имени: мира нет — сохранение битое
  if (!portals.every((portal) => Object.hasOwn(worlds, portal.world))) return false
  return isStaff(staff) && Array.isArray(log) && log.every(isLogEntry)
}

export function serializeSave(save: SavedGame): string {
  return JSON.stringify({ version: SAVE_VERSION, lab: save.lab, rngState: save.rngState })
}

// null — нет сохранения или оно непригодно; вызывающий начинает с чистой лаборатории
export function parseSave(raw: string | null): SavedGame | null {
  if (raw === null) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(data) || data.version !== SAVE_VERSION) return null
  const { lab, rngState } = data
  if (!isUint32(rngState) || !isLab(lab)) return null
  return { lab, rngState }
}
