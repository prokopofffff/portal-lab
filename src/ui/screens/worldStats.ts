// Числа мира для атласа и страницы мира: считаются из порталов, в мире не хранятся (docs/spec.md §9)
import { CONFIG, type Lab, type Portal, type World } from '../../domain'

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

// Порталы в мир: открытые и архив закрытых и схлопнувшихся, в порядке открытия
export function worldPortals(lab: Lab, worldName: string): Portal[] {
  return lab.portals.filter((p) => p.world === worldName)
}

export function worldStats(lab: Lab, world: World): WorldStats {
  const open = worldPortals(lab, world.name).filter((p) => p.status === 'open')
  const full = world.creatures > 0 && world.studied >= world.creatures
  const donePct = world.creatures > 0 ? Math.round((world.studied / world.creatures) * 100) : 0
  const best = open.reduce((max, p) => Math.max(max, p.studyProgress), 0)
  const nextPct = full
    ? 0
    : Math.min(99, Math.round((best / CONFIG.study.observerTicksPerCreature) * 100))
  const nextBarPct = world.creatures > 0 && !full ? nextPct / world.creatures : 0
  return { open: open.length, full, donePct, nextPct, nextBarPct }
}
