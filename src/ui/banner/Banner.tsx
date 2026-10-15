import { useCallback, useEffect } from 'react'
import { useLabStore, useNotifications } from '../../app/hooks'
import type { Notification } from '../../app/notifications'
import './banner.css'

// Баннер уведомления (канвас 24-c-banner): рамка цвета вида, плашка со значком 8×8, заголовок и текст.
// Размеры, шрифты, отступы и въезд bnIn — дословно из исходника кадра; цвета — CSS-переменные токенов.

/** Вид баннера: совпадает с видом уведомления в очереди (kind канваса). */
export type BannerKind = 'refuse' | 'collapse' | 'lost' | 'studied' | 'hired'

interface KindLook {
  // рамка, плашка значка, значок и заголовок
  c: string
  dark: string
  ic: string
  title: string
  // значок 8×8 (icon канваса)
  icon: string
}

// Цвета вида — токены bannerRefuse… (в канвасе c / dark / ic)
const color = (kind: string) => ({
  c: `var(--c-banner-${kind})`,
  dark: `var(--c-banner-${kind}-dark)`,
  ic: `var(--c-banner-${kind}-icon)`,
})

const KINDS: Record<BannerKind, KindLook> = {
  refuse: {
    ...color('refuse'),
    title: 'ОТКАЗ',
    icon: 'M0,0h2v2h-2z M6,0h2v2h-2z M2,2h2v2h-2z M4,2h2v2h-2z M2,4h2v2h-2z M4,4h2v2h-2z M0,6h2v2h-2z M6,6h2v2h-2z',
  },
  collapse: {
    ...color('collapse'),
    title: 'ПОРТАЛ СХЛОПНУЛСЯ',
    icon: 'M2,0h4v1h-4z M1,1h1v1h-1z M6,1h1v1h-1z M0,2h1v4h-1z M7,2h1v4h-1z M1,6h1v1h-1z M6,6h1v1h-1z M2,7h4v1h-4z M3,3h2v2h-2z',
  },
  lost: {
    ...color('lost'),
    title: 'НАБЛЮДАТЕЛИ ПОТЕРЯНЫ',
    icon: 'M2,0h4v1h-4z M1,1h6v7h-6z M3,2h2v1h-2z M2,3h4v1h-4z M3,4h2v3h-2z',
  },
  studied: {
    ...color('studied'),
    title: 'МИР ИЗУЧЕН',
    icon: 'M3,0h2v1h-2z M3,1h2v2h-2z M0,3h8v1h-8z M1,4h6v1h-6z M2,5h4v1h-4z M1,6h2v2h-2z M5,6h2v2h-2z',
  },
  hired: {
    ...color('hired'),
    title: 'НАЁМ ЗАВЕРШЁН',
    icon: 'M2,0h4v1h-4z M1,1h6v1h-6z M1,2h1v3h-1z M6,2h1v3h-1z M1,5h6v1h-6z M0,6h8v2h-8z',
  },
}

// Крестик «скрыть» 8×8 в том же пиксельном стиле
const CLOSE_ICON =
  'M0,0h1v1h-1z M7,0h1v1h-1z M1,1h1v1h-1z M6,1h1v1h-1z M2,2h1v1h-1z M5,2h1v1h-1z M3,3h2v2h-2z M2,5h1v1h-1z M5,5h1v1h-1z M1,6h1v1h-1z M6,6h1v1h-1z M0,7h1v1h-1z M7,7h1v1h-1z'

/** Через столько баннер скрывается сам, мс. */
export const BANNER_TIMEOUT = 6000

export interface BannerProps {
  kind: BannerKind
  text: string
  /** Скрыть баннер: кнопкой или само через BANNER_TIMEOUT. Ссылка должна быть стабильной. */
  onDismiss: () => void
  /**
   * Озвучивает ли сам баннер свою роль (alert / status). Стопка отключает её у системных видов:
   * их читает постоянная область NotificationStack, а status, вставленный уже с текстом, читалки
   * часто пропускают.
   */
  live?: boolean
}

/**
 * Баннер уведомления. Отказ — role="alert": текст зачитывается сразу. Системные виды — role="status"
 * (вежливо): на ×20 они частые и не должны перебивать. Таймер автоскрытия идёт с монтирования:
 * чтобы новое уведомление получило свои 6 с и заново въехало, его рендерят с новым key.
 */
export function Banner({ kind, text, onDismiss, live = true }: BannerProps) {
  const k = KINDS[kind]

  useEffect(() => {
    const timer = setTimeout(onDismiss, BANNER_TIMEOUT)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      role={!live ? undefined : kind === 'refuse' ? 'alert' : 'status'}
      className="banner"
      style={{ fontFamily: 'var(--f-ui)' }}
    >
      <div className="banner-notch" style={{ background: k.c, padding: 4 }}>
        <div
          className="banner-notch"
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 14,
            background: 'var(--c-panel)',
            padding: '10px 16px 10px 10px',
          }}
        >
          <div
            style={{
              flex: 'none',
              width: 56,
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: k.dark,
              boxShadow: `inset 0 0 0 2px ${k.c}`,
            }}
          >
            <svg
              viewBox="0 0 8 8"
              width={32}
              height={32}
              shapeRendering="crispEdges"
              aria-hidden="true"
            >
              <path d={k.icon} fill={k.ic} />
            </svg>
          </div>
          <div
            style={{
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 6,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--f-pixel)',
                fontSize: 11,
                lineHeight: '14px',
                letterSpacing: 1,
                color: k.ic,
              }}
            >
              {k.title}
            </span>
            <span
              style={{
                fontSize: 17,
                lineHeight: '20px',
                color: 'var(--c-text)',
                textWrap: 'pretty',
              }}
            >
              {text}
            </span>
          </div>
          <button
            type="button"
            className="banner-close"
            aria-label="Скрыть уведомление"
            onClick={onDismiss}
            style={{
              flex: 'none',
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              viewBox="0 0 8 8"
              width={12}
              height={12}
              shapeRendering="crispEdges"
              aria-hidden="true"
            >
              <path d={CLOSE_ICON} fill={k.ic} />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// Запись очереди со своим стабильным onDismiss: перерисовка стопки не сбрасывает её таймер
function StackItem({ notification }: { notification: Notification }) {
  const store = useLabStore()
  const { id, kind, text } = notification
  const onDismiss = useCallback(() => store.dismissNotification(id), [store, id])
  // Озвучивает сам баннер только отказ; остальные — область стопки
  return <Banner kind={kind} text={text} onDismiss={onDismiss} live={kind === 'refuse'} />
}

// Текст только для скринридера: не виден и не занимает места
const SR_ONLY = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const

/**
 * Очередь уведомлений баннерами в правом верхнем углу, поверх всего — и экрана, и карточки портала.
 * Порядок прихода сверху вниз (канвас 16-banners); при открытой карточке стопка выше (05-card-rejection).
 * Каждый баннер скрывается сам и кнопкой, свои 6 с
 * он отсчитывает с монтирования. Положение и ширина — в классе banner-stack.
 * Стопка и вежливая область озвучивания (role="status", тексты системных уведомлений) смонтированы
 * всегда, пустые без уведомлений: живая область должна появиться раньше текста, иначе читалка его
 * не объявит. Отказ озвучивает сам баннер (role="alert").
 */
export function NotificationStack({ cardOpen = false }: { cardOpen?: boolean }) {
  const notifications = useNotifications()
  return (
    <>
      <div role="status" style={SR_ONLY}>
        {notifications
          .filter((n) => n.kind !== 'refuse')
          .map((n) => (
            <p key={n.id}>{n.text}</p>
          ))}
      </div>
      <div className={cardOpen ? 'banner-stack banner-stack--card' : 'banner-stack'}>
        {notifications.map((n) => (
          <StackItem key={n.id} notification={n} />
        ))}
      </div>
    </>
  )
}
