import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Rune } from '../sprites/Rune'
import type { RiskLevel } from '../theme/tokens'
import './dialog.css'

// Диалог-свиток поверх всего (канвас 15-dialogs): затемнение, пергамент с двумя валиками, ОК и «Отмена».
// Выводится в document.body: вызывающий сам делает своё содержимое inert, пока свиток открыт.

/** Тон заголовка: цвет названия по уровню (в канвасе high / mid / crit). */
export type ScrollTone = 'high' | 'medium' | 'critical'

/** Вид кнопки ОК: danger — необратимое действие, mark — обычное. */
export type ScrollOkTone = 'danger' | 'mark'

export type ScrollDialogProps = {
  /** Руна перед заголовком. */
  rune: RiskLevel
  /** Цвет заголовка. */
  tone: ScrollTone
  /** Заголовок: прописными, шрифтом-пикселем. */
  title: string
  /** Строка под заголовком (например, «ББ-310-1 · Багровая Бездна»). */
  sub?: string
  /** Основной текст; им описывается диалог (aria-describedby). */
  text: ReactNode
  /** Содержимое между текстом и кнопками: существа, поле заметки. */
  children?: ReactNode
  okLabel: string
  okTone: ScrollOkTone
  onOk: () => void
  /** Кнопка «Отмена», Esc и клик по затемнению. */
  onCancel: () => void
  /** Что получает фокус при открытии; по умолчанию «Отмена» (безопасный выбор). */
  initialFocus?: RefObject<HTMLElement | null>
}

const titleColors: Record<ScrollTone, string> = {
  high: 'var(--c-scroll-title-high)',
  medium: 'var(--c-scroll-title-medium)',
  critical: 'var(--c-scroll-title-critical)',
}

const okColors: Record<ScrollOkTone, { fg: string; bg: string; edge: string }> = {
  danger: { fg: 'var(--c-on-danger)', bg: 'var(--c-danger-bg)', edge: 'var(--c-danger-edge)' },
  mark: { fg: 'var(--c-on-torch)', bg: 'var(--c-torch)', edge: 'var(--c-torch-light)' },
}

const FOCUSABLE =
  'button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

// Валик: градиент и тень из канваса; верхний идёт вниз по светлоте, нижний — зеркально
const roller = (angle: number): CSSProperties => ({
  height: 22,
  margin: '0 -10px',
  background: `linear-gradient(${angle}deg, var(--c-scroll-roll-light) 0, var(--c-scroll-roll-mid) 55%, var(--c-scroll-edge) 100%)`,
  boxShadow: '0 3px 0 var(--c-scroll-roll-shadow)',
})

const buttonBase: CSSProperties = {
  minHeight: 52,
  padding: '6px 10px',
  boxSizing: 'border-box',
  fontFamily: 'var(--f-ui)',
  fontSize: 17,
  fontWeight: 600,
  lineHeight: '19px',
  cursor: 'pointer',
}

export function ScrollDialog({
  rune,
  tone,
  title,
  sub,
  text,
  children,
  okLabel,
  okTone,
  onOk,
  onCancel,
  initialFocus,
}: ScrollDialogProps) {
  const titleId = useId()
  const textId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const initialRef = useRef(initialFocus)
  // Нажатие и отпускание мыши пришлись прямо на затемнение (а не на свиток)
  const pressedBackdrop = useRef(false)
  const releasedBackdrop = useRef(false)
  // Последний onCancel без переподписки на клавиатуру при каждой перерисовке
  const cancelHandler = useRef(onCancel)
  useEffect(() => {
    cancelHandler.current = onCancel
  })

  // Что было в фокусе до открытия: запоминаем до того, как свиток заберёт фокус (layout-эффект
  // идёт раньше обычного), возвращаем при закрытии, если элемент ещё на экране
  const opener = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const active = document.activeElement
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null
  }, [])
  useEffect(() => {
    ;(initialRef.current?.current ?? cancelRef.current)?.focus()
    return () => {
      const target = opener.current
      opener.current = null
      if (target?.isConnected) target.focus()
    }
  }, [])

  // Клавиши ловим на document в фазе перехвата: сработают, где бы ни был фокус (на body после клика
  // по затемнению, на баннере над свитком), и раньше слушателя карточки портала (он на document
  // в фазе всплытия и пропускает defaultPrevented)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        cancelHandler.current()
      } else if (e.key === 'Tab') trapTab(e)
    }
    // Ловушка фокуса: Tab с последнего элемента идёт на первый, Shift+Tab с первого — на последний;
    // фокус вне свитка Tab возвращает в него
    const trapTab = (e: KeyboardEvent) => {
      const dialog = dialogRef.current
      const items = Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      const first = items[0]
      const last = items.at(-1)
      if (!first || !last) return
      const active = document.activeElement
      const outside = !dialog?.contains(active)
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  const ok = okColors[okTone]
  return createPortal(
    <div
      data-testid="scroll-backdrop"
      className="scroll-backdrop"
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onMouseUp={(e) => {
        releasedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        // Отмена, только если и нажатие, и отпускание пришлись на затемнение. Браузер отдаёт click
        // общему предку нажатия и отпускания, поэтому его цель — затемнение и тогда, когда
        // выделение заметки отпущено за краем свитка или нажатие на затемнении отпущено на свитке
        const clicked = pressedBackdrop.current && releasedBackdrop.current
        pressedBackdrop.current = false
        releasedBackdrop.current = false
        if (clicked && e.target === e.currentTarget) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 25, // выше карточки портала (20), ниже стопки баннеров (30)
        display: 'flex',
        overflowY: 'auto',
        background: 'var(--c-overlay)',
      }}
    >
      <div
        ref={dialogRef}
        className="scroll-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        style={{
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--f-ui)',
          color: 'var(--c-ink-title)',
        }}
      >
        <div style={roller(180)} />
        <div
          style={{
            boxSizing: 'border-box',
            padding: '24px 28px 26px',
            background: 'var(--c-parchment)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: 'inset 0 -5px 0 var(--c-parchment-shade)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Rune level={rune} size={22} />
            <span
              id={titleId}
              style={{
                fontFamily: 'var(--f-pixel)',
                fontSize: 13,
                lineHeight: '20px',
                color: titleColors[tone],
              }}
            >
              {title}
            </span>
          </div>
          {sub && (
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-ink-link)' }}>{sub}</span>
          )}
          <p
            id={textId}
            style={{
              margin: 0,
              fontFamily: 'var(--f-prose)',
              fontSize: 19,
              lineHeight: '25px',
              color: 'var(--c-ink-title)',
              textWrap: 'pretty',
            }}
          >
            {text}
          </p>
          {children}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={onOk}
              style={{
                ...buttonBase,
                flex: '3 1 0',
                color: ok.fg,
                background: ok.bg,
                border: `3px solid ${ok.edge}`,
                boxShadow: 'inset 0 -4px 0 var(--c-bevel-soft)',
              }}
            >
              {okLabel}
            </button>
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              style={{
                ...buttonBase,
                flex: '2 1 0',
                color: 'var(--c-ink-body)',
                background: 'var(--c-parchment-plate)',
                border: '3px solid var(--c-scroll-edge)',
                boxShadow: 'inset 0 -4px 0 var(--c-bevel-faint)',
              }}
            >
              Отмена
            </button>
          </div>
        </div>
        <div style={roller(0)} />
      </div>
    </div>,
    document.body,
  )
}
