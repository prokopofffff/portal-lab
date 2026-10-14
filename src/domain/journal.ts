// Журнал лаборатории (docs/spec.md §8): команда + её события или отказ → записи журнала.
import { execute, type Command, type DomainEvent } from './commands'
import { CONFIG } from './config'
import type { Lab, LogEntry, LogKind } from './lab'
import type { Rng } from './rng'
import { RISK_LEVEL_LABELS } from './risk'
import { tick, type RiskLevelChanged, type TickEvent } from './tick'

// rejection — причина отказа; тогда events пуст, а лаборатория отличается только записью в журнале
export type DispatchResult = { lab: Lab; events: DomainEvent[]; rejection?: string }

// Названия действий смотрителя для записей об отказе (spec §5)
const COMMAND_LABELS: Record<Command['type'], string> = {
  openPortal: 'Открыть портал',
  sealLab: 'Запечатать лабораторию',
  stabilize: 'Стабилизировать',
}

// Портал с миром в именительном падеже: так он назван в журнале, сводке и уведомлениях (spec §2.4)
export function portalLabel(portal: string, world: string): string {
  return `${portal} (${world})`
}

// Выполняет команду и пишет её итог в журнал; now — реальное время, мс
export function dispatch(lab: Lab, command: Command, rng: Rng, now: number): DispatchResult {
  const result = execute(lab, command, rng)
  if ('rejection' in result) {
    const entry = rejectionEntry(lab, command, result.rejection, now)
    return {
      lab: { ...lab, log: append(lab.log, [entry]) },
      events: [],
      rejection: result.rejection,
    }
  }

  const entries = result.events.map((event) => actionEntry(result.lab, event, now))
  return { lab: { ...result.lab, log: append(result.lab.log, entries) }, events: result.events }
}

export type AdvanceResult = { lab: Lab; events: TickEvent[] }

// Тик + записи журнала вида 'system' (spec §4, §8); now — реальное время, мс
export function advance(lab: Lab, now: number): AdvanceResult {
  const result = tick(lab)
  const entries = result.events.map((event) => systemEntry(result.lab.time, event, now))
  return { lab: { ...result.lab, log: append(result.lab.log, entries) }, events: result.events }
}

// Фильтры книги журнала; не заданный фильтр пропускает всё (spec §8)
export interface LogFilter {
  kind?: LogKind
  portal?: string
  world?: string
}

// История портала — фильтр по порталу, история мира — по миру (все его порталы, включая прошлые)
export function filterLog(log: LogEntry[], filter: LogFilter): LogEntry[] {
  return log.filter(
    (e) =>
      (filter.kind === undefined || e.kind === filter.kind) &&
      (filter.portal === undefined || e.portal === filter.portal) &&
      (filter.world === undefined || e.world === filter.world),
  )
}

// Дописывает записи, оставляя последние CONFIG.journalLimit
function append(log: LogEntry[], entries: LogEntry[]): LogEntry[] {
  return [...log, ...entries].slice(-CONFIG.journalLimit)
}

// Запись об отказе; у команды с порталом в ней имя портала и его мир (мира нет, если портала с таким именем нет)
function rejectionEntry(lab: Lab, command: Command, reason: string, now: number): LogEntry {
  const label = COMMAND_LABELS[command.type]
  const lowered = `${reason[0]!.toLowerCase()}${reason.slice(1)}`
  const base = { time: lab.time, realTime: now, kind: 'rejection' as const }
  if (!('portal' in command)) {
    return { ...base, portal: null, world: null, text: `Отказ «${label}»: ${lowered}` }
  }
  const { portal } = command
  const world = lab.portals.find((p) => p.name === portal)?.world ?? null
  const target = world === null ? portal : portalLabel(portal, world)
  return { ...base, portal, world, text: `Отказ «${label}» ${target}: ${lowered}` }
}

// Запись по событию команды (spec §8): действие смотрителя, а смена уровня риска — системная запись
function actionEntry(lab: Lab, event: DomainEvent, now: number): LogEntry {
  const base = { time: lab.time, realTime: now, portal: event.portal, world: event.world }
  switch (event.type) {
    case 'portalOpened': {
      const visit = event.firstVisit ? 'новый мир' : 'повторное посещение'
      const text = `Открыт портал ${portalLabel(event.portal, event.world)} — ${visit}`
      return { ...base, kind: 'action', text }
    }
    case 'portalStabilized': {
      const { portal, world, scoreFrom, scoreTo } = event
      const text = `Стабилизирован ${portalLabel(portal, world)}: балл риска ${scoreFrom} → ${scoreTo}`
      return { ...base, kind: 'action', text }
    }
    case 'riskLevelChanged':
      return riskLevelEntry(lab.time, event, now)
  }
}

// Смена уровня риска пишется одинаково, пришла она от тика или от команды
function riskLevelEntry(time: number, event: RiskLevelChanged, now: number): LogEntry {
  const { portal, world, from, to } = event
  const text = `${portalLabel(portal, world)}: уровень риска: ${RISK_LEVEL_LABELS[from]} → ${RISK_LEVEL_LABELS[to]}`
  return { time, realTime: now, portal, world, kind: 'system', text }
}

// Текст записи по событию тика (spec §8); time — время после тика
function systemEntry(time: number, event: TickEvent, now: number): LogEntry {
  const base = { time, realTime: now, kind: 'system' as const }
  switch (event.type) {
    case 'hireCompleted':
      return {
        ...base,
        portal: null,
        world: null,
        text: 'Наём завершён: свободных наблюдателей +1',
      }
    case 'creatureStudied': {
      const { portal, world, studied, creatures } = event
      const text = `${portalLabel(portal, world)}: изучено существо — ${studied} из ${creatures}`
      return { ...base, portal, world, text }
    }
    case 'worldStudied': {
      const { world, creatures, returned } = event
      const text = `Мир ${world} изучен: все существа (${creatures}) — наблюдатели вернулись: ${returned}`
      return { ...base, portal: null, world, text }
    }
    case 'portalCollapsed': {
      const { portal, world, cause } = event
      const reason = cause === 'time' ? 'время вышло' : 'стабильность упала до 0'
      return { ...base, portal, world, text: `${portalLabel(portal, world)} схлопнулся: ${reason}` }
    }
    case 'observersLost': {
      const { portal, world, count } = event
      return {
        ...base,
        portal,
        world,
        text: `${portalLabel(portal, world)}: потеряно наблюдателей — ${count}`,
      }
    }
    case 'riskLevelChanged':
      return riskLevelEntry(time, event, now)
    case 'acceptanceRevoked': {
      const { portal, world, acceptedAt, level } = event
      const text = `${portalLabel(portal, world)}: принятие снято — уровень риска вырос: ${RISK_LEVEL_LABELS[acceptedAt]} → ${RISK_LEVEL_LABELS[level]}`
      return { ...base, portal, world, text }
    }
  }
}
