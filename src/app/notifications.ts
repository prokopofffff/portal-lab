// Очередь уведомлений-баннеров (канвас 16-banners, 24-c-banner): отказы команд и события тика.
import type { TickEvent } from '../domain'
import { observersNoun } from '../domain/plural'

export type NotificationKind = 'refuse' | 'collapse' | 'lost' | 'studied' | 'hired'

export interface Notification {
  id: number
  kind: NotificationKind
  text: string
}

// В очереди остаются только новейшие: канвас стекает пять баннеров
export const MAX_NOTIFICATIONS = 5

// «Потерян 1 наблюдатель», но «Потеряно 11 наблюдателей»: глагол согласуется с числом
function lostVerb(count: number): string {
  return count % 10 === 1 && count % 100 !== 11 ? 'Потерян' : 'Потеряно'
}

function fromEvent(event: TickEvent): Omit<Notification, 'id'> | null {
  switch (event.type) {
    case 'portalCollapsed':
      return { kind: 'collapse', text: `${event.portal} (${event.world}) сжался и погас` }
    case 'observersLost':
      return {
        kind: 'lost',
        text: `${lostVerb(event.count)} ${event.count} ${observersNoun(event.count)} при схлопывании ${event.portal}`,
      }
    case 'worldStudied':
      return {
        kind: 'studied',
        text: `${event.world} изучен полностью — ${event.creatures} из ${event.creatures} существ`,
      }
    case 'hireCompleted':
      return { kind: 'hired', text: 'Новый наблюдатель прибыл в лабораторию и свободен' }
    default:
      return null
  }
}

// Уведомления по событиям одного тика, в порядке событий; id им присваивает store
export function notificationsFromTick(events: TickEvent[]): Omit<Notification, 'id'>[] {
  const result: Omit<Notification, 'id'>[] = []
  for (const event of events) {
    const notification = fromEvent(event)
    if (notification !== null) result.push(notification)
  }
  return result
}
