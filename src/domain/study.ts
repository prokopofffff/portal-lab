// Изучение мира в числах (docs/spec.md §4, §9): считается из порталов, в мире не хранится.
import { CONFIG } from './config'
import type { Lab, Portal, World } from './lab'

export interface WorldStats {
  // Открытых порталов в мир
  open: number
  // Все существа изучены (мир без существ не считается изученным)
  full: boolean
  // Изучено, % существ мира
  donePct: number
  // Прогресс следующего существа, %: у лучшего из открытых порталов мира
  nextPct: number
  // Ширина участка следующего существа на полоске мира, % от всей полоски
  nextBarPct: number
}

// Прогресс изучения существа порталом, %. Потолок 99: на 100 существо уже изучено
// и прогресс переходит на следующее
export function creaturePct(studyProgress: number): number {
  return Math.min(99, Math.round((studyProgress / CONFIG.study.observerTicksPerCreature) * 100))
}

// Порталы в мир: открытые и архив закрытых и схлопнувшихся, в порядке открытия
export function worldPortals(lab: Lab, worldName: string): Portal[] {
  return lab.portals.filter((p) => p.world === worldName)
}

export function worldStats(lab: Lab, world: World): WorldStats {
  const open = worldPortals(lab, world.name).filter((p) => p.status === 'open')
  const full = world.creatures > 0 && world.studied >= world.creatures
  const donePct = world.creatures > 0 ? Math.round((world.studied / world.creatures) * 100) : 0
  const best = open.reduce((max, p) => Math.max(max, p.studyProgress), 0)
  const nextPct = full ? 0 : creaturePct(best)
  const nextBarPct = world.creatures > 0 && !full ? nextPct / world.creatures : 0
  return { open: open.length, full, donePct, nextPct, nextBarPct }
}
