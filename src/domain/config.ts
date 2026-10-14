// Все числа симуляции в одном месте (docs/spec.md, Приложение B).
// Менять баланс — только здесь.

export const CONFIG = {
  // Время: один тик = одна минута симуляции (spec §2.2, §3)
  tick: { simMinutes: 1, realMsAtX1: 1000 },
  // Доступные скорости: пауза, x1, x5, x20 (spec §3)
  speeds: [0, 1, 5, 20],
  // Предел одновременно открытых порталов (spec §2.2)
  maxOpenPortals: 12,
  // Диапазоны параметров нового портала (spec Приложение B)
  spawn: {
    energy: { min: 10, max: 95 },
    stability: { min: 20, max: 100 },
    timeLeft: { min: 30, max: 400 },
    worldCreatures: { min: 0, max: 15 },
  },
  // Границы энергии и стабильности (spec Приложение B)
  bounds: { energy: { min: 0, max: 100 }, stability: { min: 0, max: 100 } },
  // Оценка риска: веса, окно срочности, пороги уровней, жёсткое правило (spec Приложение B)
  risk: {
    weights: { instability: 0.4, energy: 0.3, urgency: 0.3 },
    urgencyWindow: 120,
    thresholds: { medium: 30, high: 55, critical: 75 },
    hardRule: { maxTimeLeft: 10, maxStability: 15 },
  },
  // Деградация портала за тик (spec Приложение B)
  degradation: { energyDivisor: 200, observerFactor: 0.5 },
  // Действие «стабилизировать» (spec Приложение B)
  stabilize: {
    stabilityGain: 25,
    energyCost: 10,
    timeGain: 20,
    cooldownTicks: 30,
    forbiddenFromStability: 95,
  },
  // Изучение существ наблюдателями (spec Приложение B)
  study: { observerTicksPerCreature: 20 },
  // Предел наблюдателей на одном портале (spec Приложение B)
  maxObserversPerPortal: 3,
  // Штат лаборатории: стартовый и максимальный (spec Приложение B)
  staff: { initial: 3, max: 5 },
  // Найм нового сотрудника (spec Приложение B)
  hire: { ticks: 20 },
  // Сколько порталов показывать в «Требуют внимания» (spec §7)
  attentionLimit: 3,
  // Максимум записей в журнале (spec Приложение B)
  journalLimit: 500,
} as const

export type Config = typeof CONFIG
