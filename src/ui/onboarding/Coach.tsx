import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRoute } from '../../app/navigation'
import {
  advanceStep,
  pickHint,
  stepAt,
  TOUR_STEPS,
  type Fact,
  type TourContext,
  type TourTarget,
} from './tour'
import './onboarding.css'

// Подсказка обучения (docs/spec.md §12): рамка факела вокруг цели и свиток у края экрана со стороны,
// противоположной цели. В document.body над карточкой и свитками: рамка клики не перехватывает,
// свиток — только своими кнопками.

const GAP = 18 // от цели до свитка
const EDGE = 8 // от края окна
const RING = 6 // рамка шире цели на столько с каждой стороны
const WIDTH = 340

// Цель на экране: в DOM, не под inert (карточка или свиток поверх) и не нулевого размера
function findTarget(target: TourTarget): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    if (el.closest('[inert]')) continue
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) return el
  }
  return null
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

interface Layout {
  text: string
  ring: Box | null
  panel: { top: number; left: number }
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height)

const sameLayout = (a: Layout | null, b: Layout) =>
  a !== null &&
  a.text === b.text &&
  sameBox(a.ring, b.ring) &&
  a.panel.top === b.panel.top &&
  a.panel.left === b.panel.left

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

const reducedMotion = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export function Coach({ facts, onExit }: { facts: ReadonlySet<Fact>; onExit: () => void }) {
  const route = useRoute()
  const [index, setIndex] = useState(0)
  const ctx: TourContext = { facts, route }
  // Шаг выводится из фактов и маршрута на рендере; индекс только растёт
  const next = advanceStep(index, ctx)
  if (next !== index) setIndex(next)
  const step = stepAt(next)
  const last = next === TOUR_STEPS.length - 1

  const panelRef = useRef<HTMLElement>(null)
  const [layout, setLayout] = useState<Layout | null>(null)
  // Последний контекст для цикла кадров без его перезапуска на каждом тике
  const ctxRef = useRef(ctx)
  useLayoutEffect(() => {
    ctxRef.current = ctx
  })

  // Каждый кадр: какая подсказка, где цель, где свиток. Цель двигают прокрутка, ресайз, свитки и
  // анимации — проще мерить, чем подписываться на всё
  useLayoutEffect(() => {
    let frame = 0
    let scrolledTo: Element | null = null
    function measure() {
      const hint = pickHint(step, ctxRef.current, (target) => findTarget(target) !== null)
      const el = hint.target ? findTarget(hint.target) : null
      const vw = document.documentElement.clientWidth || window.innerWidth
      const vh = window.innerHeight
      const width = Math.min(WIDTH, vw - 2 * EDGE)
      const height = panelRef.current?.offsetHeight ?? 0
      let ring: Box | null = null
      let panel = { left: (vw - width) / 2, top: Math.max(EDGE, (vh - height) / 2) }
      if (el) {
        const rect = el.getBoundingClientRect()
        // Новая цель за краем окна — докручиваем к ней один раз, дальше игрок волен листать
        if (el !== scrolledTo) {
          scrolledTo = el
          if (rect.top < 0 || rect.bottom > vh) {
            el.scrollIntoView?.({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
          }
        }
        ring = {
          top: Math.round(rect.top - RING),
          left: Math.round(rect.left - RING),
          width: Math.round(rect.width + 2 * RING),
          height: Math.round(rect.height + 2 * RING),
        }
        // Цель в карточке или свитке: подсказка сбоку от них, чтобы не закрыть их текст; не
        // помещается сбоку — над или под свитком (карточка выше окна, её обходим по самой цели)
        const host = el.closest('.card-dialog, .scroll-dialog')
        const box = host?.getBoundingClientRect()
        const beside = clamp(rect.top + rect.height / 2 - height / 2, EDGE, vh - height - EDGE)
        if (box && vw - box.right >= width + GAP + EDGE) {
          panel = { left: box.right + GAP, top: beside }
        } else if (box && box.left >= width + GAP + EDGE) {
          panel = { left: box.left - GAP - width, top: beside }
        } else {
          const around = host?.classList.contains('scroll-dialog') && box ? box : rect
          const below = around.top + around.height / 2 < vh / 2
          const top = below ? around.bottom + GAP : around.top - GAP - height
          panel = {
            left: clamp(rect.left + rect.width / 2 - width / 2, EDGE, vw - width - EDGE),
            top: clamp(top, EDGE, vh - height - EDGE),
          }
        }
      }
      panel = { left: Math.round(panel.left), top: Math.round(panel.top) }
      const nextLayout = { text: hint.text, ring, panel }
      setLayout((prev) => (sameLayout(prev, nextLayout) ? prev : nextLayout))
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [step])

  const text = layout?.text ?? pickHint(step, ctx, () => false).text
  return createPortal(
    <>
      {layout?.ring && (
        <div
          className="tour-ring"
          aria-hidden="true"
          data-testid="tour-ring"
          style={{ position: 'fixed', ...layout.ring }}
        />
      )}
      <aside
        ref={panelRef}
        className="tour-panel"
        aria-label="Обучение"
        style={{
          position: 'fixed',
          top: layout?.panel.top ?? EDGE,
          left: layout?.panel.left ?? EDGE,
          width: `min(${WIDTH}px, calc(100vw - ${2 * EDGE}px))`,
        }}
      >
        <div className="tour-roller" />
        <div className="tour-sheet">
          <span className="tour-title">
            ОБУЧЕНИЕ · {next + 1} / {TOUR_STEPS.length}
          </span>
          <p className="tour-text" aria-live="polite">
            {text}
          </p>
          {last ? (
            <button type="button" className="tour-btn tour-btn-ok" onClick={onExit}>
              В лабораторию
            </button>
          ) : (
            <button type="button" className="tour-btn" onClick={onExit}>
              Выйти из обучения
            </button>
          )}
        </div>
        <div className="tour-roller" />
      </aside>
    </>,
    document.body,
  )
}
