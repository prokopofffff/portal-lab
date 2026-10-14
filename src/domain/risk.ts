// Оценка риска открытого портала (docs/spec.md §3). Константы — в CONFIG.risk.
import { CONFIG } from './config'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface RiskMetrics {
  stability: number
  energy: number
  timeLeft: number
}

export interface RiskAssessment {
  score: number
  level: RiskLevel
  // Вклад каждой составляющей в балл (уже с весом, без округления)
  parts: { instability: number; energy: number; urgency: number }
  hardRule: boolean
}

function levelForScore(score: number): RiskLevel {
  const { thresholds } = CONFIG.risk
  if (score >= thresholds.critical) return 'critical'
  if (score >= thresholds.high) return 'high'
  if (score >= thresholds.medium) return 'medium'
  return 'low'
}

export function assessRisk(metrics: RiskMetrics): RiskAssessment {
  const { weights, urgencyWindow, hardRule: hardLimits } = CONFIG.risk
  const instability = 100 - metrics.stability
  const urgency =
    metrics.timeLeft >= urgencyWindow ? 0 : 100 * (1 - metrics.timeLeft / urgencyWindow)
  const parts = {
    instability: weights.instability * instability,
    energy: weights.energy * metrics.energy,
    urgency: weights.urgency * urgency,
  }
  // Сумма в float может дать 29,4999… вместо ровно 29,5 и округлиться вниз.
  // Сначала срезаем шум до 6 знаков, потом округляем до целого.
  const noiseScale = 1e6
  const rawScore = parts.instability + parts.energy + parts.urgency
  const score = Math.round(Math.round(rawScore * noiseScale) / noiseScale)
  // Жёсткое правило: мало времени или низкая стабильность — критический уровень при любом балле
  const hardRule =
    metrics.timeLeft <= hardLimits.maxTimeLeft || metrics.stability <= hardLimits.maxStability
  const level = hardRule ? 'critical' : levelForScore(score)
  return { score, level, parts, hardRule }
}
