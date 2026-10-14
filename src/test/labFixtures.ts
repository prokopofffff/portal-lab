// Сборка лаборатории для UI-тестов: готовое состояние кладётся в store через сохранение
import type { Lab, LogEntry, Portal, World } from '../domain'
import { serializeSave } from '../domain'
import { createLabStore, type LabStore } from '../app/store'

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)

export function world(name: string, code: string, fields: Partial<World> = {}): World {
  return { name, code, creatures: 9, studied: 0, visits: 1, lastVisit: 0, ...fields }
}

export function portal(name: string, worldName: string, fields: Partial<Portal> = {}): Portal {
  return {
    name,
    world: worldName,
    status: 'open',
    arch: 0,
    energy: 40,
    stability: 80,
    timeLeft: 200,
    observers: 0,
    studyProgress: 0,
    cooldown: 0,
    questioned: null,
    acceptedAt: null,
    ...fields,
  }
}

export function logEntry(time: number, text: string, fields: Partial<LogEntry> = {}): LogEntry {
  return { time, realTime: NOW, portal: null, world: null, kind: 'system', text, ...fields }
}

export function labWith(fields: Partial<Lab> & Pick<Lab, 'worlds'>): Lab {
  return {
    time: 143,
    portals: [],
    staff: { free: 3, hireTicksLeft: 0, lost: 0 },
    log: [],
    ...fields,
  }
}

// Store, поднятый из сохранения с готовой лабораторией
export function storeWithLab(lab: Lab): LabStore {
  const raw = serializeSave({ lab, rngState: 1 })
  return createLabStore({
    storage: { getItem: () => raw, setItem: () => {} },
    seed: 1,
    now: () => NOW,
  })
}
