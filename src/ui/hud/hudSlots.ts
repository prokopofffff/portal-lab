// Данные HUD смотрителя (канвас 17-c-hud): слоты наблюдателей и счётчики сводки (spec §7)
import { CONFIG, type Summary } from '../../domain'

export type SlotKind = 'free' | 'onsite' | 'transit' | 'empty'

// Подпись под слотом и его имя для чтения с экрана
export const SLOT_TEXT: Record<SlotKind, { text: string; aria: string }> = {
  free: { text: 'свободен', aria: 'Наблюдатель свободен' },
  onsite: { text: 'на месте', aria: 'Наблюдатель на месте, в портале' },
  transit: { text: 'в пути', aria: 'Наблюдатель в пути, идёт найм' },
  empty: { text: 'пусто', aria: 'Пустой слот' },
}

// Ровно CONFIG.staff.max слотов: свободные, на месте, в пути, остальные пустые
export function observerSlots(staff: Summary['staff']): SlotKind[] {
  const filled: SlotKind[] = [
    ...Array<SlotKind>(staff.free).fill('free'),
    ...Array<SlotKind>(staff.onSite).fill('onsite'),
    ...Array<SlotKind>(staff.inTransit).fill('transit'),
  ].slice(0, CONFIG.staff.max)
  return [...filled, ...Array<SlotKind>(CONFIG.staff.max - filled.length).fill('empty')]
}

// Доля пройденного найма: 0 в начале, ближе к 1 к концу
export function hireProgress(hireTicksLeft: number): number {
  return (CONFIG.hire.ticks - hireTicksLeft) / CONFIG.hire.ticks
}

export interface HudStat {
  label: string
  value: string
  // high — порталов открыто до предела, critical — есть критические
  alert: 'high' | 'critical' | null
}

// Шесть счётчиков сводки в порядке канваса
export function hudStats(s: Summary): HudStat[] {
  return [
    {
      label: 'ОТКРЫТО',
      value: `${s.open} / ${s.maxOpen}`,
      alert: s.open >= s.maxOpen ? 'high' : null,
    },
    { label: 'КРИТИЧЕСКИХ', value: String(s.critical), alert: s.critical > 0 ? 'critical' : null },
    { label: 'ЗАКРЫТО', value: String(s.closed), alert: null },
    { label: 'СХЛОПНУЛОСЬ', value: String(s.collapsed), alert: null },
    { label: 'МИРОВ', value: String(s.worlds), alert: null },
    { label: 'ИЗУЧЕНО СУЩЕСТВ', value: `${s.studied} / ${s.creatures}`, alert: null },
  ]
}
