import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDispatch, useLabSelector, useLabStore } from '../../app/hooks'
import { useNavigate, type BaseRoute } from '../../app/navigation'
import { closeConfirmation, type Command } from '../../domain'
import { cardValues, portalCard } from './cardModel'
import { PortalCard, type CardDelta } from './PortalCard'
import './card.css'

// Диалог карточки портала поверх экрана (канвас 04-card-critical): затемнение на всё приложение,
// карточка в 20 px от верха (по горизонтали её ставит .card-overlay); затемнение прокручивается,
// если карточка выше окна.
// Симуляция идёт дальше: карточка перечитывает store на каждом изменении.

/** Вопрос перед закрытием последнего портала в мир с неизученными (spec §5). */
function closeQuestion(ask: { world: string; unstudied: number; creatures: number }) {
  return `Это последний открытый портал в ${ask.world}. Не изучено ${ask.unstudied} из ${ask.creatures} существ — продолжить изучение можно будет, только если портал в этот мир откроется снова`
}

/** Вопрос о заметке при пометке «Под вопросом» (канвас 15-dialogs). */
function noteQuestion(portal: string) {
  return `Пометить ${portal} «Под вопросом»? Заметка (необязательно): что нужно проверить?`
}

// Крестик «закрыть карточку» 8×8, как значок отказа в канвасе 24-c-banner
const CLOSE_ICON =
  'M0,0h2v2h-2z M6,0h2v2h-2z M2,2h2v2h-2z M4,2h2v2h-2z M2,4h2v2h-2z M4,4h2v2h-2z M0,6h2v2h-2z M6,6h2v2h-2z'

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Закрыть карточку"
      title="Закрыть карточку (Esc)"
      onClick={onClose}
      style={{
        // Слева от карточки: справа сверху встаёт баннер уведомлений
        position: 'absolute',
        top: 0,
        right: 'calc(100% + 12px)',
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        background: 'var(--c-panel)',
        border: '3px solid var(--c-edge-strong)',
        boxShadow: 'inset 0 -4px 0 var(--c-ability-shade)',
        cursor: 'pointer',
      }}
    >
      <svg viewBox="0 0 8 8" width={16} height={16} shapeRendering="crispEdges" aria-hidden="true">
        <path d={CLOSE_ICON} fill="var(--c-text-soft)" />
      </svg>
    </button>
  )
}

/** Затемнение с диалогом: Esc, крестик и клик по затемнению закрывают. */
function Overlay({
  labelledBy,
  focusKey,
  archived = false,
  onClose,
  children,
}: {
  labelledBy: string
  // Смена ключа (другой портал) снова ставит фокус на диалог и прокручивает к началу
  focusKey: string
  // Портал больше не открыт (закрыт, схлопнулся): способности исчезли вместе с фокусом на них
  archived?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Последний onClose без переподписки на клавиатуру при каждой перерисовке (тики симуляции)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    overlayRef.current?.scrollTo?.(0, 0)
    dialogRef.current?.focus()
  }, [focusKey])

  // Карточка ушла в архив, пока открыта: фокус был на исчезнувшей кнопке (теперь он на body)
  // или где-то в карточке — возвращаем его на сам диалог, чтобы не потерять внутри aria-modal
  useEffect(() => {
    if (!archived) return
    const dialog = dialogRef.current
    const active = document.activeElement
    if (dialog && (active === null || active === document.body || dialog.contains(active))) {
      dialog.focus()
    }
  }, [archived])

  useEffect(() => {
    // Esc, уже потраченный внутри (скрыть подсказку отказа), карточку не закрывает
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      ref={overlayRef}
      data-testid="card-overlay"
      className="card-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        display: 'flex',
        alignItems: 'flex-start',
        background: 'var(--c-overlay)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{ position: 'relative', outline: 'none' }}
      >
        <CloseButton onClose={onClose} />
        {children}
      </div>
    </div>
  )
}

/**
 * Карточка портала в диалоге. Действия — команды через dispatch; отказы показывает баннер приложения.
 * Закрытие последнего портала в мир и пометка «Под вопросом» спрашивают через window.confirm /
 * window.prompt — до диалогов-свитков lab-9dr.7.
 */
export function PortalCardDialog({ portal, back }: { portal: string; back: BaseRoute }) {
  const store = useLabStore()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const headingId = useId()
  const lab = useLabSelector((state) => state.lab)
  const model = useMemo(() => portalCard(lab, portal), [lab, portal])
  // «Было» после успешной стабилизации — только для того портала, с карточки которого она пришла
  const [delta, setDelta] = useState<{ portal: string; delta: CardDelta } | null>(null)

  const close = () => navigate(back)

  if (!model) {
    return (
      <Overlay labelledBy={headingId} focusKey={portal} onClose={close}>
        <div
          className="card-notch"
          style={{
            width: 600,
            padding: '18px 20px',
            background: 'var(--s-sill)',
            boxShadow: 'inset 0 0 0 3px var(--c-edge-soft)',
          }}
        >
          <h2
            id={headingId}
            style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--c-row-title)' }}
          >
            Портал {portal} не найден
          </h2>
        </div>
      </Overlay>
    )
  }

  function act(command: Command) {
    const current = store.getState().lab
    // Карточка по store на момент клика: «было» для стабилизации и включена ли пометка
    const was = portalCard(current, portal)
    if (command.type === 'closePortal') {
      // Спрашиваем, только если закрыть можно: недоступное «Закрыть» сразу уходит в домен за отказом
      const closable = was?.abilities.find((a) => a.command === 'closePortal')?.available ?? false
      const ask = closable ? closeConfirmation(current, command.portal) : null
      if (ask && !window.confirm(closeQuestion(ask))) {
        setDelta(null)
        dispatch({ type: 'cancelClose', portal: command.portal })
        return
      }
    }
    if (command.type === 'toggleQuestioned' && !was?.questioned) {
      const note = window.prompt(noteQuestion(command.portal), '')
      if (note === null) return
      command = { ...command, note }
    }
    const result = dispatch(command)
    const now = portalCard(store.getState().lab, portal)
    if (command.type === 'stabilize' && result.rejection === undefined && was && now) {
      // Пара «до — сразу после» как её показала карточка; дальше симуляция её не двигает
      setDelta({ portal, delta: { before: cardValues(was), after: cardValues(now) } })
    } else {
      setDelta(null)
    }
  }

  return (
    <Overlay
      labelledBy={headingId}
      focusKey={portal}
      archived={model.status !== 'open'}
      onClose={close}
    >
      <PortalCard
        model={model}
        headingId={headingId}
        delta={delta?.portal === portal ? delta.delta : undefined}
        onAction={act}
        onOpenWorld={(world) => navigate({ screen: 'world', world })}
        onOpenPortal={(name) => {
          setDelta(null)
          navigate({ screen: 'portal', portal: name, back })
        }}
      />
    </Overlay>
  )
}
