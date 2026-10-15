// Модель карточки портала (docs/spec.md §3, §5, §6, §8): всё, что показывает карточка, считается здесь,
// компонент только рисует. Без React и без цветов — только данные и тексты.
import {
  assessRisk,
  CONFIG,
  creaturePct,
  execute,
  filterLog,
  recommend,
  RISK_LEVEL_LABELS,
  worldPortals,
  worldStats,
  type Command,
  type LogEntry,
  type LogKind,
  type Portal,
  type PortalStatus,
  type Recommendation,
  type Rng,
  type Lab,
  type RiskAssessment,
  type RiskLevel,
} from '../../domain'

/** Метрика портала: округлённое значение и ширина полоски, %. */
export interface CardMetric {
  value: number
  pct: number
}

/** Часть разбора риска: подпись и вклад в балл (целые, в сумме дают балл). */
export interface RiskPart {
  label: string
  value: number
}

export interface CardStudy {
  // Изучено существ мира, всего существ, изучено % мира
  studied: number
  creatures: number
  worldPct: number
  // Существо, которое изучается сейчас, и прогресс этого портала; null — изучать нечего или портал в архиве
  current: { number: number; pct: number } | null
  // Наблюдатели на месте и предел
  observers: number
  maxObservers: number
  // Имена других открытых порталов в тот же мир
  others: string[]
}

export interface CardAdvice {
  action: Recommendation['action']
  // Название действия: «Стабилизировать», «Оставить открытым»…
  label: string
  // Причина с большой буквы, как её отдаёт домен
  reason: string
  // Строка карточки: «<Действие> — <причина с маленькой буквы>»
  text: string
  // Хвост строки после названия действия: « — <причина с маленькой буквы>»
  tail: string
}

export type AbilityCommand =
  | 'stabilize'
  | 'closePortal'
  | 'sendObserver'
  | 'recallObservers'
  | 'toggleQuestioned'
  | 'acceptAsIs'

export interface CardAbility {
  command: AbilityCommand
  label: string
  // Команда пройдёт; если нет — reason это отказ домена, который покажет тот же клик
  available: boolean
  reason: string | null
  recommended: boolean
  // Перезарядка (только стабилизация, пока идёт): left — минут осталось, elapsed — доля прошедшего, 0–1
  cooldown: { left: number; elapsed: number } | null
}

export interface CardHistoryEntry {
  // Устойчивый ключ записи для списка: время, реальное время, текст и номер среди одинаковых
  key: string
  time: number
  text: string
  kind: LogKind
}

export interface PortalCardModel {
  name: string
  world: string
  status: PortalStatus
  // ОТКРЫТ / ЗАКРЫТ / СХЛОПНУЛСЯ
  statusWord: string
  // Риск по текущим (у архивного — по последним) метрикам; label с большой буквы
  risk: { level: RiskLevel; score: number; label: string }
  // «Последний риск: <Уровень> · <балл>» — только у закрытого и схлопнувшегося
  lastRisk: string | null
  metrics: { energy: CardMetric; stability: CardMetric; timeLeft: CardMetric }
  // нестабильность + энергия + срочность = итого (risk.score)
  parts: RiskPart[]
  // Текст печати жёсткого правила; только у открытого портала
  hardRule: string | null
  study: CardStudy
  // null у закрытого и схлопнувшегося
  advice: CardAdvice | null
  // Пусто у закрытого и схлопнувшегося
  abilities: CardAbility[]
  // Пометка «под вопросом»; note может быть пустой строкой
  questioned: { note: string } | null
  history: CardHistoryEntry[]
  // Итог для архива; null у открытого
  archive: string | null
}

const STATUS_WORDS: Record<PortalStatus, string> = {
  open: 'ОТКРЫТ',
  closed: 'ЗАКРЫТ',
  collapsed: 'СХЛОПНУЛСЯ',
}

// Способности в порядке макета (spec §5)
const ABILITIES: { command: AbilityCommand; label: string }[] = [
  { command: 'stabilize', label: 'Стабилизировать' },
  { command: 'closePortal', label: 'Закрыть' },
  { command: 'sendObserver', label: 'Отправить наблюдателя' },
  { command: 'recallObservers', label: 'Отозвать наблюдателей' },
  { command: 'toggleQuestioned', label: 'Под вопросом' },
  { command: 'acceptAsIs', label: 'Принять как есть' },
]

const ADVICE_LABELS: Record<Recommendation['action'], string> = {
  stabilize: 'Стабилизировать',
  closePortal: 'Закрыть',
  sendObserver: 'Отправить наблюдателя',
  recallObservers: 'Отозвать наблюдателей',
  acceptAsIs: 'Принять как есть',
  keepOpen: 'Оставить открытым',
}

// ГСЧ, который бросает при любом обращении: команды карточки случайности не тянут,
// а если потянут — это ошибка, которую нельзя проглотить
const THROWING_RNG: Rng = {
  next: () => unexpectedRng(),
  int: () => unexpectedRng(),
  pick: () => unexpectedRng(),
  state: () => unexpectedRng(),
}

function unexpectedRng(): never {
  throw new Error('Команда карточки обратилась к ГСЧ')
}

const upperFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1)

// Целые доли, дающие в сумме ровно total: округляем вниз, недостающие единицы — тем,
// у кого дробная часть больше (при равенстве — раньше по порядку)
function largestRemainder(values: number[], total: number): number[] {
  const floors = values.map(Math.floor)
  const missing = total - floors.reduce((a, b) => a + b, 0)
  const byRemainder = values
    .map((v, i) => ({ i, rest: v - floors[i]! }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of byRemainder.slice(0, Math.max(0, missing))) floors[i]! += 1
  return floors
}

function riskParts({ parts, score }: RiskAssessment): RiskPart[] {
  const [instability, energy, urgency] = largestRemainder(
    [parts.instability, parts.energy, parts.urgency],
    score,
  ) as [number, number, number]
  return [
    { label: 'нестабильность', value: instability },
    { label: 'энергия', value: energy },
    { label: 'срочность', value: urgency },
  ]
}

function hardRuleText(portal: Portal, risk: RiskAssessment): string | null {
  if (portal.status !== 'open' || !risk.hardRule) return null
  const { maxTimeLeft, maxStability } = CONFIG.risk.hardRule
  return portal.timeLeft <= maxTimeLeft
    ? `время ≤ ${maxTimeLeft} → критический`
    : `стабильность ≤ ${maxStability} → критический`
}

function studyOf(lab: Lab, portal: Portal): CardStudy {
  const world = lab.worlds[portal.world]!
  const stats = worldStats(lab, world)
  const fullyStudied = stats.full || world.creatures === 0
  return {
    studied: world.studied,
    creatures: world.creatures,
    worldPct: stats.donePct,
    current:
      portal.status !== 'open' || fullyStudied
        ? null
        : { number: world.studied + 1, pct: creaturePct(portal.studyProgress) },
    observers: portal.observers,
    maxObservers: CONFIG.maxObserversPerPortal,
    others: worldPortals(lab, portal.world)
      .filter((p) => p.status === 'open' && p.name !== portal.name)
      .map((p) => p.name),
  }
}

function adviceOf(lab: Lab, name: string): CardAdvice | null {
  const rec = recommend(lab, name)
  if (!rec) return null
  const label = ADVICE_LABELS[rec.action]
  const tail = ` — ${lowerFirst(rec.reason)}`
  return { action: rec.action, label, reason: rec.reason, text: label + tail, tail }
}

function abilitiesOf(lab: Lab, portal: Portal, advice: CardAdvice | null): CardAbility[] {
  if (portal.status !== 'open') return []
  const { cooldownTicks } = CONFIG.stabilize
  return ABILITIES.map(({ command, label }) => {
    // Доступность решает домен: пробуем команду и смотрим, отказал ли он
    const result = execute(lab, { type: command, portal: portal.name } as Command, THROWING_RNG)
    const rejection = 'rejection' in result ? result.rejection : null
    const cooling = command === 'stabilize' && portal.cooldown > 0
    return {
      command,
      label,
      available: rejection === null,
      reason: rejection,
      recommended: advice?.action === command,
      cooldown: cooling
        ? { left: portal.cooldown, elapsed: 1 - portal.cooldown / cooldownTicks }
        : null,
    }
  })
}

function archiveText(lab: Lab, portal: Portal, history: CardHistoryEntry[]): string | null {
  if (portal.status === 'open') return null
  const world = lab.worlds[portal.world]!
  const last = history[history.length - 1]
  const when = last ? ` на минуте ${last.time}` : ''
  const ending =
    portal.status === 'collapsed'
      ? `Портал схлопнулся${when}.`
      : `Портал закрыт смотрителем${when}.`
  let tail: string
  if (world.creatures === 0) tail = `В мире «${world.name}» нет существ.`
  else if (world.studied >= world.creatures) {
    tail = `Мир изучен полностью — все ${world.creatures} существ в атласе.`
  } else {
    tail = `Существа остались в мире «${world.name}»: изучено ${world.studied} из ${world.creatures}, продолжить можно через новый портал в этот мир.`
  }
  return `${ending} ${tail}`
}

// История портала; у записи нет id, поэтому ключ собирается из её полей и номера среди одинаковых
function historyOf(entries: LogEntry[]): CardHistoryEntry[] {
  const seen = new Map<string, number>()
  return entries.map(({ time, realTime, text, kind }) => {
    const base = `${time}|${realTime}|${text}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return { key: `${base}|${n}`, time, text, kind }
  })
}

/** Значения, которые карточка показывает для «было — стало»: балл и округлённые метрики. */
export interface CardValues {
  score: number
  energy: number
  stability: number
  timeLeft: number
}

export function cardValues(model: PortalCardModel): CardValues {
  return {
    score: model.risk.score,
    energy: model.metrics.energy.value,
    stability: model.metrics.stability.value,
    timeLeft: model.metrics.timeLeft.value,
  }
}

/** Карточка портала по имени; null, если такого портала нет. */
export function portalCard(lab: Lab, name: string): PortalCardModel | null {
  const portal = lab.portals.find((p) => p.name === name)
  if (!portal) return null

  const risk = assessRisk(portal)
  const { level, score } = risk
  const label = upperFirst(RISK_LEVEL_LABELS[level])
  const archived = portal.status !== 'open'
  const advice = adviceOf(lab, name)
  const history = historyOf(filterLog(lab.log, { portal: name }))

  return {
    name: portal.name,
    world: portal.world,
    status: portal.status,
    statusWord: STATUS_WORDS[portal.status],
    risk: { level, score, label },
    lastRisk: archived ? `Последний риск: ${label} · ${score}` : null,
    metrics: {
      energy: { value: Math.round(portal.energy), pct: Math.round(portal.energy) },
      stability: { value: Math.round(portal.stability), pct: Math.round(portal.stability) },
      timeLeft: {
        value: Math.ceil(portal.timeLeft),
        pct: Math.min(100, Math.round((portal.timeLeft / CONFIG.spawn.timeLeft.max) * 100)),
      },
    },
    parts: riskParts(risk),
    hardRule: hardRuleText(portal, risk),
    study: studyOf(lab, portal),
    advice,
    abilities: abilitiesOf(lab, portal, advice),
    questioned: portal.questioned,
    history,
    archive: archiveText(lab, portal, history),
  }
}
