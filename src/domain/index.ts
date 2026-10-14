// Доменный слой: чистый TypeScript без React и браузерных API.
// Наполняется задачами эпика lab-cl5 (docs/spec.md §2–8).
export const DOMAIN_READY = true
export { CONFIG } from './config'
export type { Config } from './config'
export { createRng } from './rng'
export type { Rng } from './rng'
export { WORLD_NAMES, portalName, worldCode } from './worlds'
export { assessRisk } from './risk'
export type { RiskAssessment, RiskLevel, RiskMetrics } from './risk'
