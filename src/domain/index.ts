// Доменный слой: чистый TypeScript без React и браузерных API.
// Наполняется задачами эпика lab-cl5 (docs/spec.md §2–8).
export const DOMAIN_READY = true
export { CONFIG } from './config'
export type { Config } from './config'
export { createRng } from './rng'
export type { Rng } from './rng'
export { WORLD_NAMES, portalName, worldCode } from './worlds'
export { assessRisk, RISK_LEVEL_LABELS } from './risk'
export type { RiskAssessment, RiskLevel, RiskMetrics } from './risk'
export { createLab } from './lab'
export type { Lab, LogEntry, LogKind, Portal, PortalStatus, Staff, World } from './lab'
export { execute } from './commands'
export type { Command, CommandResult, DomainEvent } from './commands'
export { dispatch, filterLog } from './journal'
export type { DispatchResult, LogFilter } from './journal'
export { tick } from './tick'
export type { TickEvent, TickResult } from './tick'
