// Журнал лаборатории (docs/spec.md §8): команда + её события или отказ → записи журнала.
import { execute, type Command, type DomainEvent } from './commands'
import { CONFIG } from './config'
import type { Lab, LogEntry, LogKind } from './lab'
import type { Rng } from './rng'
import { RISK_LEVEL_LABELS } from './risk'
import { tick, type TickEvent } from './tick'

// rejection — причина отказа; тогда events пуст, а лаборатория отличается только записью в журнале
export type DispatchResult = { lab: Lab; events: DomainEvent[]; rejection?: string }

// Названия действий смотрителя для записей об отказе (spec §5)
const COMMAND_LABELS: Record<Command['type'], string> = {
  openPortal: 'Открыть портал',
}

// Выполняет команду и пишет её итог в журнал; now — реальное время, мс
export function dispatch(lab: Lab, command: Command, rng: Rng, now: number): DispatchResult {
  const result = execute(lab, command, rng)
  if ('rejection' in result) {
    const reason = result.rejection
    const entry: LogEntry = {
      time: lab.time,
      realTime: now,
      portal: null,
      world: null,
      kind: 'rejection',
      text: `Отказ «${COMMAND_LABELS[command.type]}»: ${reason[0]!.toLowerCase()}${reason.slice(1)}`,
    }
    return { lab: { ...lab, log: append(lab.log, [entry]) }, events: [], rejection: reason }
  }

  const entries = result.events.map((event) => actionEntry(result.lab, event, now))
  return { lab: { ...result.lab, log: append(result.lab.log, entries) }, events: result.events }
}

// Тик + записи журнала вида 'system' (spec §4, §8); now — реальное время, мс
export function advance(lab: Lab, now: number): { lab: Lab; events: TickEvent[] } {
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

function actionEntry(lab: Lab, event: DomainEvent, now: number): LogEntry {
  const visit = event.firstVisit ? 'новый мир' : 'повторное посещение'
  return {
    time: lab.time,
    realTime: now,
    portal: event.portal,
    world: event.world,
    kind: 'action',
    text: `Открыт портал ${event.portal} (${event.world}) — ${visit}`,
  }
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
      const text = `${portal} (${world}): изучено существо — ${studied} из ${creatures}`
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
      return { ...base, portal, world, text: `${portal} (${world}) схлопнулся: ${reason}` }
    }
    case 'observersLost': {
      const { portal, world, count } = event
      return {
        ...base,
        portal,
        world,
        text: `${portal} (${world}): потеряно наблюдателей — ${count}`,
      }
    }
    case 'riskLevelChanged': {
      const { portal, world, from, to } = event
      const text = `${portal} (${world}): уровень риска: ${RISK_LEVEL_LABELS[from]} → ${RISK_LEVEL_LABELS[to]}`
      return { ...base, portal, world, text }
    }
    case 'acceptanceRevoked': {
      const { portal, world, acceptedAt, level } = event
      const text = `${portal} (${world}): принятие снято — уровень риска вырос: ${RISK_LEVEL_LABELS[acceptedAt]} → ${RISK_LEVEL_LABELS[level]}`
      return { ...base, portal, world, text }
    }
  }
}
