import { useEffect } from 'react'
import { useLabStore, useRejection } from '../../app/hooks'
import './banner.css'

// Баннер уведомления (канвас 24-c-banner): рамка цвета вида, плашка со значком 8×8, заголовок и текст.
// Размеры, шрифты, отступы и въезд bnIn — дословно из исходника кадра; цвета — CSS-переменные токенов.

/** Вид баннера. Пока только отказ; остальные виды канваса добавит lab-9dr.7. */
export type BannerKind = 'refuse'

interface KindLook {
  // рамка, плашка значка, значок и заголовок
  c: string
  dark: string
  ic: string
  title: string
  // значок 8×8 (icon канваса)
  icon: string
}

const KINDS: Record<BannerKind, KindLook> = {
  refuse: {
    c: 'var(--c-banner-refuse)',
    dark: 'var(--c-banner-refuse-dark)',
    ic: 'var(--c-banner-refuse-icon)',
    title: 'ОТКАЗ',
    icon: 'M0,0h2v2h-2z M6,0h2v2h-2z M2,2h2v2h-2z M4,2h2v2h-2z M2,4h2v2h-2z M4,4h2v2h-2z M0,6h2v2h-2z M6,6h2v2h-2z',
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
}

/**
 * Баннер уведомления; role="alert" — текст зачитывается сразу. Таймер автоскрытия идёт с монтирования:
 * чтобы новое уведомление получило свои 6 с и заново въехало, его рендерят с новым key.
 */
export function Banner({ kind, text, onDismiss }: BannerProps) {
  const k = KINDS[kind]

  useEffect(() => {
    const timer = setTimeout(onDismiss, BANNER_TIMEOUT)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div role="alert" className="banner" style={{ width: 480, fontFamily: 'var(--f-ui)' }}>
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
              width: 20,
              height: 20,
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

/**
 * Отказ последней команды (store.rejection) баннером в правом верхнем углу, поверх всего — и экрана,
 * и карточки портала: отказы из HUD («Нанять») и из карточки показываются одинаково.
 */
export function RejectionBanner() {
  const rejection = useRejection()
  const { dismissRejection } = useLabStore()
  if (!rejection) return null
  return (
    <div style={{ position: 'fixed', top: 24, right: 20, zIndex: 30 }}>
      <Banner key={rejection.id} kind="refuse" text={rejection.text} onDismiss={dismissRejection} />
    </div>
  )
}
