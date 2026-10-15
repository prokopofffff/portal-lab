import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useDispatch, useLabSelector, useLabStore } from '../../app/hooks'
import { useNavigate, type BaseRoute } from '../../app/navigation'
import { closeConfirmation, type Command } from '../../domain'
import { ScrollDialog } from '../dialog/ScrollDialog'
import { Creatures } from '../sprites/Creatures'
import { cardValues, portalCard } from './cardModel'
import { PortalCard, type CardDelta } from './PortalCard'
import './card.css'

// Диалог карточки портала поверх экрана (канвас 04-card-critical): затемнение на всё приложение,
// карточка в 20 px от верха (по горизонтали и на узком экране её ставит .card-overlay); затемнение
// прокручивается, если карточка выше окна.
// Симуляция идёт дальше: карточка перечитывает store на каждом изменении.

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
      // Место крестика (слева от карточки, на узком экране — над ней) — в классе card-close
      className="card-close"
      style={{
        position: 'absolute',
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
  inert = false,
  onClose,
  children,
}: {
  labelledBy: string
  // Смена ключа (другой портал) снова ставит фокус на диалог и прокручивает к началу
  focusKey: string
  // Портал больше не открыт (закрыт, схлопнулся): способности исчезли вместе с фокусом на них
  archived?: boolean
  // Поверх карточки открыт свиток: она недоступна, а Esc принадлежит свитку
  inert?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Последний onClose без переподписки на клавиатуру при каждой перерисовке (тики симуляции)
  const closeRef = useRef(onClose)
  const inertRef = useRef(inert)
  useEffect(() => {
    closeRef.current = onClose
    inertRef.current = inert
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

  // Свиток закрылся, а кнопки, с которой его открыли, уже нет (портал схлопнулся): фокус
  // остался на body — возвращаем его на диалог
  useEffect(() => {
    if (inert) return
    const active = document.activeElement
    if (active === null || active === document.body) dialogRef.current?.focus()
  }, [inert])

  useEffect(() => {
    // Esc, уже потраченный внутри (скрыть подсказку отказа), карточку не закрывает;
    // пока открыт свиток, Esc его, а не карточки
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !inertRef.current) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      ref={overlayRef}
      data-testid="card-overlay"
      inert={inert}
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
        className="card-dialog"
        style={{ position: 'relative', outline: 'none' }}
      >
        <CloseButton onClose={onClose} />
        {children}
      </div>
    </div>
  )
}

/** Свиток поверх карточки: что спрашиваем (spec §5, канвас 15-dialogs). */
type Ask = { kind: 'close'; world: string; unstudied: number; creatures: number } | { kind: 'note' }

/** Поле заметки свитка «Под вопросом»: стили из канваса 15-dialogs. */
function NoteField({ fieldRef }: { fieldRef: RefObject<HTMLTextAreaElement | null> }) {
  const id = useId()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-ink-body)' }}>
        Заметка <span style={{ fontWeight: 400, color: 'var(--c-ink-time)' }}>(необязательно)</span>
      </label>
      <textarea
        ref={fieldRef}
        id={id}
        className="scroll-note"
        rows={3}
        placeholder="Что нужно проверить?"
        style={{
          boxSizing: 'border-box',
          width: '100%',
          resize: 'none',
          padding: '10px 12px',
          fontFamily: 'var(--f-prose)',
          fontSize: 18,
          lineHeight: '23px',
          color: 'var(--c-ink-title)',
          background: 'var(--c-parchment-field)',
          border: '3px solid var(--c-scroll-edge)',
        }}
      />
    </div>
  )
}

/**
 * Карточка портала в диалоге. Действия — команды через dispatch; отказы показывает баннер приложения.
 * Закрытие последнего портала в мир и пометка «Под вопросом» спрашивают в свитке поверх карточки
 * (карточка пока инертна, симуляция идёт).
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
  // Открытый свиток: вопрос, заданный на момент клика (портал за это время мог измениться)
  const [ask, setAsk] = useState<Ask | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const close = () => navigate(back)

  if (!model) {
    return (
      <Overlay labelledBy={headingId} focusKey={portal} onClose={close}>
        <div
          className="card-notch card-frame"
          style={{
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

  // Команда в домен; после успешной стабилизации запоминает пару «до — сразу после»
  function run(command: Command) {
    const was = portalCard(store.getState().lab, portal)
    const result = dispatch(command)
    const now = portalCard(store.getState().lab, portal)
    if (command.type === 'stabilize' && result.rejection === undefined && was && now) {
      // Пара «до — сразу после» как её показала карточка; дальше симуляция её не двигает
      setDelta({ portal, delta: { before: cardValues(was), after: cardValues(now) } })
    } else {
      setDelta(null)
    }
  }

  function act(command: Command) {
    const current = store.getState().lab
    // Карточка по store на момент клика: включена ли пометка и можно ли закрыть
    const was = portalCard(current, portal)
    if (command.type === 'closePortal') {
      // Спрашиваем, только если закрыть можно: недоступное «Закрыть» сразу уходит в домен за отказом
      const closable = was?.abilities.find((a) => a.command === 'closePortal')?.available ?? false
      const question = closable ? closeConfirmation(current, command.portal) : null
      if (question) {
        setAsk({ kind: 'close', ...question })
        return
      }
    }
    if (command.type === 'toggleQuestioned' && !was?.questioned) {
      setAsk({ kind: 'note' })
      return
    }
    run(command)
  }

  function answer(ok: boolean) {
    const current = ask
    setAsk(null)
    if (current?.kind === 'close') {
      if (ok) {
        run({ type: 'closePortal', portal })
      } else {
        setDelta(null)
        // Портал мог перестать быть открытым, пока свиток висел: домен отклонил бы отмену ложным отказом
        const now = portalCard(store.getState().lab, portal)
        if (now?.status === 'open') dispatch({ type: 'cancelClose', portal })
      }
    } else if (current?.kind === 'note' && ok) {
      run({ type: 'toggleQuestioned', portal, note: (noteRef.current?.value ?? '').trim() })
    }
  }

  return (
    <>
      <Overlay
        labelledBy={headingId}
        focusKey={portal}
        archived={model.status !== 'open'}
        inert={ask !== null}
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
      {ask?.kind === 'close' && (
        <ScrollDialog
          rune="high"
          tone="high"
          title="ЗАКРЫТЬ ПОСЛЕДНИЙ ПОРТАЛ?"
          text={`Это последний открытый портал в ${ask.world}. Не изучено ${ask.unstudied} из ${ask.creatures} существ — продолжить изучение можно будет, только если портал в этот мир откроется снова.`}
          okLabel="Закрыть всё равно"
          okTone="danger"
          onOk={() => answer(true)}
          onCancel={() => answer(false)}
        >
          <Creatures total={ask.creatures} studied={ask.creatures - ask.unstudied} size={28} />
        </ScrollDialog>
      )}
      {ask?.kind === 'note' && (
        <ScrollDialog
          rune="medium"
          tone="medium"
          title="ПОМЕТИТЬ «ПОД ВОПРОСОМ»"
          sub={`${portal} · ${model.world}`}
          text="Портал получит значок и попадёт под фильтр «Под вопросом». Заметка приколется к его карте."
          okLabel="Пометить"
          okTone="mark"
          initialFocus={noteRef}
          onOk={() => answer(true)}
          onCancel={() => answer(false)}
        >
          <NoteField fieldRef={noteRef} />
        </ScrollDialog>
      )}
    </>
  )
}
