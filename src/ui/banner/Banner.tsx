import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
} from 'react'
import { useLabStore, useNotifications } from '../../app/hooks'
import { MAX_NOTIFICATIONS, type Notification } from '../../app/notifications'
import { deckLayout, type DeckPlace } from './deck'
import './banner.css'

// Баннер уведомления (канвас 24-c-banner): рамка цвета вида, плашка со значком 8×8, заголовок и текст.
// Размеры, шрифты и отступы — дословно из исходника кадра; цвета — CSS-переменные токенов. Въезд bnIn
// плавный, а не ступенями канваса (README, «Решения и допущения»).

/** Вид баннера: совпадает с видом уведомления в очереди (kind канваса). */
export type BannerKind = 'refuse' | 'collapse' | 'lost' | 'studied' | 'hired'

interface KindLook {
  // рамка, плашка значка, значок и заголовок
  c: string
  dark: string
  ic: string
  title: string
  // заголовок для области озвучивания: обычным регистром, прописные читалки порой читают по буквам
  spoken: string
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
    spoken: 'Отказ',
    icon: 'M0,0h2v2h-2z M6,0h2v2h-2z M2,2h2v2h-2z M4,2h2v2h-2z M2,4h2v2h-2z M4,4h2v2h-2z M0,6h2v2h-2z M6,6h2v2h-2z',
  },
  collapse: {
    ...color('collapse'),
    title: 'ПОРТАЛ СХЛОПНУЛСЯ',
    spoken: 'Портал схлопнулся',
    icon: 'M2,0h4v1h-4z M1,1h1v1h-1z M6,1h1v1h-1z M0,2h1v4h-1z M7,2h1v4h-1z M1,6h1v1h-1z M6,6h1v1h-1z M2,7h4v1h-4z M3,3h2v2h-2z',
  },
  lost: {
    ...color('lost'),
    title: 'НАБЛЮДАТЕЛИ ПОТЕРЯНЫ',
    spoken: 'Наблюдатели потеряны',
    icon: 'M2,0h4v1h-4z M1,1h6v7h-6z M3,2h2v1h-2z M2,3h4v1h-4z M3,4h2v3h-2z',
  },
  studied: {
    ...color('studied'),
    title: 'МИР ИЗУЧЕН',
    spoken: 'Мир изучен',
    icon: 'M3,0h2v1h-2z M3,1h2v2h-2z M0,3h8v1h-8z M1,4h6v1h-6z M2,5h4v1h-4z M1,6h2v2h-2z M5,6h2v2h-2z',
  },
  hired: {
    ...color('hired'),
    title: 'НАЁМ ЗАВЕРШЁН',
    spoken: 'Наём завершён',
    icon: 'M2,0h4v1h-4z M1,1h6v1h-6z M1,2h1v3h-1z M6,2h1v3h-1z M1,5h6v1h-6z M0,6h8v2h-8z',
  },
}

// Крестик «скрыть» 8×8 в том же пиксельном стиле
const CLOSE_ICON =
  'M0,0h1v1h-1z M7,0h1v1h-1z M1,1h1v1h-1z M6,1h1v1h-1z M2,2h1v1h-1z M5,2h1v1h-1z M3,3h2v2h-2z M2,5h1v1h-1z M5,5h1v1h-1z M1,6h1v1h-1z M6,6h1v1h-1z M0,7h1v1h-1z M7,7h1v1h-1z'

/** Через столько баннер скрывается сам, мс. */
export const BANNER_TIMEOUT = 6000

/** Не меньше стольких мс остаётся баннеру после паузы (курсор или фокус ушли с остатком в 0,1 с). */
export const BANNER_RESUME_MIN = 2000

/** Длительность ухода баннера, мс; совпадает с bnOut в banner.css. */
export const BANNER_LEAVE = 240

// Фокус с клавиатуры. Щелчок мышью тоже фокусирует кнопку, но баннер от него замирать не должен
function keyboardFocus(el: Element): boolean {
  try {
    return el.matches(':focus-visible')
  } catch {
    return true
  }
}

// При reduced-motion уходящий баннер скрыт сразу (banner.css) и убирается без ожидания
const leaveDuration = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : BANNER_LEAVE

/**
 * Автоскрытие через BANNER_TIMEOUT с паузой: на паузе таймер снят, после неё идёт остаток
 * (но не меньше BANNER_RESUME_MIN). Остаток живёт в ref, так что перерисовки его не сбрасывают.
 */
function useAutoDismiss(onDismiss: () => void, paused: boolean): void {
  const left = useRef(BANNER_TIMEOUT)
  useEffect(() => {
    if (paused) return
    const start = Date.now()
    const timer = setTimeout(onDismiss, left.current)
    return () => {
      clearTimeout(timer)
      left.current = Math.max(BANNER_RESUME_MIN, left.current - (Date.now() - start))
    }
  }, [onDismiss, paused])
}

// Фокус ушёл за пределы элемента, а не перешёл между его потомками
const focusLeft = (e: FocusEvent<HTMLElement>) =>
  !e.currentTarget.contains(e.relatedTarget as Node | null)

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
  /** Таймер на паузе снаружи: стопка держит баннеры, пока колода под курсором или в фокусе. */
  paused?: boolean
}

/**
 * Баннер уведомления. Отказ — role="alert": текст зачитывается сразу. Системные виды — role="status"
 * (вежливо): на ×20 они частые и не должны перебивать. Таймер автоскрытия идёт с монтирования:
 * чтобы новое уведомление получило свои 6 с и заново въехало, его рендерят с новым key. Пока над
 * баннером курсор или внутри фокус с клавиатуры (WCAG 2.2.1), таймер стоит.
 */
export function Banner({ kind, text, onDismiss, live = true, paused = false }: BannerProps) {
  const k = KINDS[kind]
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  useAutoDismiss(onDismiss, paused || hovered || focused)

  return (
    <div
      role={!live ? undefined : kind === 'refuse' ? 'alert' : 'status'}
      className="banner"
      style={{ fontFamily: 'var(--f-ui)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => setFocused(keyboardFocus(e.target))}
      onBlur={(e) => {
        if (focusLeft(e)) setFocused(false)
      }}
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

const placeStyle = (place: DeckPlace, z: number): CSSProperties => ({
  transform: `translateY(${place.y}px) scale(${place.scale})`,
  filter: place.brightness < 1 ? `brightness(${place.brightness})` : undefined,
  opacity: place.hidden ? 0 : 1,
  zIndex: z,
})

/** Запись на экране: из очереди или уже убранная, но ещё доигрывающая уход. */
interface Shown {
  notification: Notification
  leaving: boolean
}

// Убранные из очереди записи остаются на своих местах уходящими; новые дописываются в конец
function mergeShown(prev: Shown[], queue: Notification[]): Shown[] {
  const byId = new Map(queue.map((n) => [n.id, n]))
  const kept = prev.map((s) => {
    const n = byId.get(s.notification.id)
    return n ? { notification: n, leaving: false } : { ...s, leaving: true }
  })
  const known = new Set(prev.map((s) => s.notification.id))
  const added = queue
    .filter((n) => !known.has(n.id))
    .map((n) => ({ notification: n, leaving: false }))
  return [...kept, ...added]
}

// Записи очереди плюс уходящие, по порядку прихода; gone убирает уходящую, когда та доиграла
function useShown(queue: Notification[]): [Shown[], (id: number) => void] {
  const [state, setState] = useState(() => ({ source: queue, shown: mergeShown([], queue) }))
  let { shown } = state
  if (state.source !== queue) {
    shown = mergeShown(state.shown, queue)
    setState({ source: queue, shown })
  }
  const gone = useCallback(
    (id: number) =>
      setState((s) => ({ ...s, shown: s.shown.filter((x) => x.notification.id !== id) })),
    [],
  )
  return [shown, gone]
}

const isLeaving = (slot: Element) => slot.classList.contains('banner-slot--leaving')

// Фокус внутри уходящего баннера: с клавиатуры переходит на «скрыть» ближайшего соседа, иначе
// снимается. Иначе стопка так и считалась бы «в фокусе» и стояла бы на паузе
function releaseFocus(slot: HTMLElement): void {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !slot.contains(active)) return
  const slots = [...(slot.parentElement?.children ?? [])]
  const i = slots.indexOf(slot)
  const next =
    slots.slice(i + 1).find((s) => !isLeaving(s)) ??
    slots
      .slice(0, i)
      .reverse()
      .find((s) => !isLeaving(s))
  const close = next?.querySelector<HTMLElement>('.banner-close')
  if (close && keyboardFocus(active)) close.focus()
  else active.blur()
}

interface StackItemProps {
  shown: Shown
  /** Место в колоде; у уходящего его нет — он остаётся там, где был. */
  style: CSSProperties | undefined
  paused: boolean
  onGone: (id: number) => void
}

// Уходящий лежит поверх соседей (слоёв в колоде не больше длины очереди), пока те встают на его место
const LEAVING_Z = MAX_NOTIFICATIONS + 1

// Запись очереди со своим стабильным onDismiss: перерисовка стопки не сбрасывает её таймер.
// Уходящая доигрывает bnOut и через BANNER_LEAVE убирается совсем
function StackItem({ shown, style, paused, onGone }: StackItemProps) {
  const store = useLabStore()
  const slot = useRef<HTMLDivElement>(null)
  const { notification, leaving } = shown
  const { id, kind, text } = notification
  const onDismiss = useCallback(() => store.dismissNotification(id), [store, id])

  // Последнее место в колоде: с него баннер и уезжает
  const [last, setLast] = useState(style)
  const key = (st: CSSProperties | undefined) => JSON.stringify(st)
  if (style && key(style) !== key(last)) setLast(style)

  useLayoutEffect(() => {
    if (leaving && slot.current) releaseFocus(slot.current)
  }, [leaving])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => onGone(id), leaveDuration())
    return () => clearTimeout(timer)
  }, [leaving, onGone, id])

  // Озвучивает сам баннер только отказ; остальные — область стопки
  return (
    <div
      ref={slot}
      data-id={id}
      className={leaving ? 'banner-slot banner-slot--leaving' : 'banner-slot'}
      style={style ?? { ...last, zIndex: LEAVING_Z }}
      aria-hidden={leaving || undefined}
    >
      <Banner
        kind={kind}
        text={text}
        onDismiss={onDismiss}
        live={kind === 'refuse'}
        paused={paused || leaving}
      />
    </div>
  )
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
 * Очередь уведомлений баннерами в правом верхнем углу, поверх всего — и экрана, и карточки портала;
 * при открытой карточке стопка выше (05-card-rejection). Лежат колодой: новейший сверху целиком,
 * предыдущие под ним корешками. Наведение или фокус с клавиатуры раскрывают колоду в столбец
 * (новейший первым, как в канвасе 16-banners) и ставят таймеры всех баннеров на паузу. Каждый баннер
 * скрывается сам и кнопкой; ушедший плавно уезжает, соседи сдвигаются на его место.
 * Места баннеров считаются по измеренным высотам (deckLayout) и задаются transform-ом, чтобы
 * переходы между ними анимировались; положение и ширина самой стопки — в классе banner-stack.
 * Стопка и вежливая область озвучивания (role="status", тексты системных уведомлений) смонтированы
 * всегда, пустые без уведомлений: живая область должна появиться раньше текста, иначе читалка его
 * не объявит. Отказ озвучивает сам баннер (role="alert").
 */
export function NotificationStack({ cardOpen = false }: { cardOpen?: boolean }) {
  const notifications = useNotifications()
  const [shown, gone] = useShown(notifications)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [heights, setHeights] = useState<ReadonlyMap<number, number>>(new Map())
  const stack = useRef<HTMLDivElement>(null)

  // Новейший первым: так и в колоде, и в раскрытом столбце, и в порядке обхода с клавиатуры
  const ordered = [...shown].reverse()
  const live = ordered.filter((s) => !s.leaving)
  // Опустевшая стопка паузу не держит: курсор мог остаться на месте, и mouseleave не придёт
  if (live.length === 0 && hovered) setHovered(false)
  const open = hovered || focused
  const deck = deckLayout(
    live.map((s) => heights.get(s.notification.id) ?? 0),
    open,
  )
  const styles = new Map(
    live.map((s, depth) => [
      s.notification.id,
      placeStyle(deck.places[depth]!, live.length - depth),
    ]),
  )

  // Высоты баннеров меряются до отрисовки кадра и при каждом изменении размера (перенос строк)
  const measure = useCallback(() => {
    const el = stack.current
    if (!el) return
    setHeights((prev) => {
      const next = new Map<number, number>()
      for (const slot of el.querySelectorAll<HTMLElement>('.banner-slot')) {
        next.set(Number(slot.dataset.id), slot.offsetHeight)
      }
      const same = next.size === prev.size && [...next].every(([id, h]) => prev.get(id) === h)
      return same ? prev : next
    })
  }, [])
  useLayoutEffect(() => {
    measure()
    const el = stack.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    for (const slot of el.children) observer.observe(slot)
    return () => observer.disconnect()
  })

  return (
    <>
      <div role="status" style={SR_ONLY}>
        {notifications
          .filter((n) => n.kind !== 'refuse')
          .map((n) => (
            // Вид баннера словами: без него «ПТ-420-1 (Пепельные Топи)» не говорит, что случилось
            <p key={n.id}>
              {KINDS[n.kind].spoken}. {n.text}
            </p>
          ))}
      </div>
      <div
        ref={stack}
        className={cardOpen ? 'banner-stack banner-stack--card' : 'banner-stack'}
        data-open={(open && live.length > 0) || undefined}
        style={{ height: deck.height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={(e) => setFocused(keyboardFocus(e.target))}
        onBlur={(e) => {
          if (focusLeft(e)) setFocused(false)
        }}
      >
        {ordered.map((s) => (
          <StackItem
            key={s.notification.id}
            shown={s}
            style={styles.get(s.notification.id)}
            paused={open}
            onGone={gone}
          />
        ))}
      </div>
    </>
  )
}
