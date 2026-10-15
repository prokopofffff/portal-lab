import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLabSelector } from '../../app/hooks'
import { filterLog, type LogEntry, type LogKind } from '../../domain'
import './screens.css'

// Записей на странице и страниц на развороте (канвас 14)
const PAGE_SIZE = 7
const SPREAD_SIZE = PAGE_SIZE * 2

// Вид записи: чернила, шрифт, значок 5×5 и подпись — дословно из таблицы KIND канваса
const KINDS: Record<
  LogKind,
  { label: string; ink: string; font: string; size: number; icon: string }
> = {
  action: {
    label: 'действие',
    ink: 'var(--c-ink-action)',
    font: 'var(--f-ink)',
    size: 23,
    icon: 'M2,0h1v1h-1z M1,1h3v1h-3z M0,2h5v2h-5z M1,4h3v1h-3z',
  },
  rejection: {
    label: 'отказ',
    ink: 'var(--c-ink-rejection)',
    font: 'var(--f-ink)',
    size: 23,
    icon: 'M0,0h1v1h-1z M4,0h1v1h-1z M1,1h1v1h-1z M3,1h1v1h-1z M2,2h1v1h-1z M1,3h1v1h-1z M3,3h1v1h-1z M0,4h1v1h-1z M4,4h1v1h-1z',
  },
  system: {
    label: 'система',
    ink: 'var(--c-ink-system)',
    font: 'var(--f-faded)',
    size: 25,
    icon: 'M1,1h3v3h-3z',
  },
}
const KIND_ORDER: readonly LogKind[] = ['action', 'rejection', 'system']

// Пустая книга: раскрытая книга 9×9 из канваса
const EMPTY_ICON = 'M0,1h9v1h-9z M0,7h9v1h-9z M0,2h1v5h-1z M8,2h1v5h-1z M4,2h1v5h-1z'

const ruledPage: CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  position: 'relative',
  boxSizing: 'border-box',
  backgroundColor: 'var(--c-parchment)',
  backgroundImage:
    'repeating-linear-gradient(0deg,transparent 0 35px,var(--c-parchment-line) 35px 36px)',
  display: 'flex',
  flexDirection: 'column',
}

// Пишущаяся запись и номер письма: у каждой новой записи он свой
interface Writing {
  entry: LogEntry
  id: number
}

const pageNumber: CSSProperties = {
  alignSelf: 'center',
  fontFamily: 'var(--f-ink)',
  fontSize: 18,
  color: 'var(--c-ink-faint)',
}

// Поля кнопки листания — в классе journal-flip-button (на узком экране уже)
const flipButton: CSSProperties = {
  height: 44,
  fontFamily: 'var(--f-ui)',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--c-parchment)',
  background: 'var(--c-tab)',
  border: '3px solid var(--c-parchment-edge)',
  cursor: 'pointer',
}

// Реальное время записи как ЧЧ:ММ по местному времени
function clock(realTime: number): string {
  const d = new Date(realTime)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Entry({
  entry,
  writing,
  onWritten,
}: {
  entry: LogEntry
  writing: boolean
  onWritten: () => void
}) {
  const kind = KINDS[entry.kind]
  return (
    <li
      data-kind={entry.kind}
      className={writing ? 'journal-entry writing' : 'journal-entry'}
      onAnimationEnd={onWritten}
      style={{
        display: 'flex',
        gap: 16,
        // В канвасе у строки нет border-box: 74 + 6 отступа = шаг 80, как у линовки страницы
        boxSizing: 'content-box',
        minHeight: 74,
        alignItems: 'flex-start',
        paddingBottom: 6,
      }}
    >
      <div
        style={{
          flex: 'none',
          width: 76,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 1,
          paddingTop: 2,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--f-ink)',
            fontSize: 21,
            lineHeight: '24px',
            color: 'var(--c-ink-time)',
          }}
        >
          мин {entry.time}
        </span>
        <span style={{ fontFamily: 'var(--f-ui)', fontSize: 11, color: 'var(--c-ink-faint)' }}>
          {clock(entry.realTime)}
        </span>
      </div>
      <span style={{ flex: 'none', width: 14, height: 14, marginTop: 7, display: 'flex' }}>
        <svg
          viewBox="0 0 5 5"
          width={14}
          height={14}
          shapeRendering="crispEdges"
          role="img"
          aria-label={kind.label}
        >
          <path d={kind.icon} fill={kind.ink} />
        </svg>
      </span>
      <span
        style={{
          fontFamily: kind.font,
          fontSize: kind.size,
          lineHeight: '26px',
          color: kind.ink,
          textWrap: 'pretty',
        }}
      >
        {entry.text}
      </span>
    </li>
  )
}

function Page({
  number,
  side,
  entries,
  writing,
  onWritten,
  children,
}: {
  number: number
  side: 'left' | 'right'
  entries: LogEntry[]
  writing: Writing | null
  onWritten: () => void
  children?: ReactNode
}) {
  const left = side === 'left'
  return (
    <section
      // Отступы и тень у корешка — в классах journal-page: на узком экране страницы друг под другом
      className={`journal-page journal-page--${side}`}
      style={ruledPage}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0' }}>
        <ol
          aria-label={`Страница ${number}`}
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {entries.map((entry, i) => (
            <Entry
              // Строка пишущейся записи получает ключ на каждую запись: на пределе журнала новая запись
              // занимает прежнюю позицию, и без свежего узла анимация бы не началась заново
              key={entry === writing?.entry ? `w${writing.id}` : i}
              entry={entry}
              writing={entry === writing?.entry}
              onWritten={onWritten}
            />
          ))}
        </ol>
        {children}
      </div>
      <span style={pageNumber}>стр. {number}</span>
      {!left && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 56,
            height: 56,
            background:
              'linear-gradient(135deg,transparent 50%,var(--c-parchment-shade) 50%,var(--c-parchment-plate))',
          }}
        />
      )}
    </section>
  )
}

function EmptyBook({ filtered }: { filtered: boolean }) {
  return (
    <div
      style={{
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        textAlign: 'center',
      }}
    >
      <svg viewBox="0 0 9 9" width={54} height={54} shapeRendering="crispEdges" aria-hidden="true">
        <path d={EMPTY_ICON} fill="var(--c-empty-icon)" />
      </svg>
      <span
        style={{
          fontFamily: 'var(--f-ink)',
          fontSize: 28,
          lineHeight: '34px',
          color: 'var(--c-ink-faint)',
          textWrap: 'pretty',
        }}
      >
        {filtered
          ? 'Под такой фильтр записей нет.'
          : 'Страницы чисты. Первая запись появится, когда откроется первый портал.'}
      </span>
    </div>
  )
}

function Legend() {
  const items: { kind: LogKind; ink: string; font: string; size: number }[] = [
    { kind: 'action', ink: 'var(--c-ink-action)', font: 'var(--f-ink)', size: 20 },
    { kind: 'rejection', ink: 'var(--c-legend-rejection)', font: 'var(--f-ink)', size: 20 },
    { kind: 'system', ink: 'var(--c-legend-system)', font: 'var(--f-faded)', size: 21 },
  ]
  return (
    <div className="journal-legend" style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      {items.map(({ kind, ink, font, size }) => (
        <span key={kind} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg
            viewBox="0 0 5 5"
            width={14}
            height={14}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <path d={KINDS[kind].icon} fill={ink} />
          </svg>
          <span
            style={{
              fontFamily: font,
              fontSize: size,
              color: kind === 'action' ? 'var(--c-parchment)' : ink,
            }}
          >
            {KINDS[kind].label}
          </span>
        </span>
      ))}
    </div>
  )
}

interface Choice {
  value: string | undefined
  label: string
}

// Закладка-фильтр: лента с названием и текущим значением, по нажатию — список значений
function Ribbon({
  label,
  allLabel,
  background,
  choices,
  selected,
  onSelect,
}: {
  label: string
  allLabel: string
  background: string
  choices: Choice[]
  selected: string | undefined
  onSelect: (value: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // Список закрывается по Escape и по нажатию вне закладки
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointer = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  const all: Choice = { value: undefined, label: allLabel }
  const current = choices.find((c) => c.value === selected) ?? all
  // Отступление от кадра 14: там у закладки нет активного вида, и фильтр видно только по третьей
  // строке. Закладка с выбранным значением выдвинута и со светлой каймой (класс journal-tab--active)
  const active = selected !== undefined
  return (
    <div ref={root} className="journal-ribbon">
      <button
        type="button"
        className={active ? 'journal-tab journal-tab--active' : 'journal-tab'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '6px 14px 18px',
          textAlign: 'left',
          fontFamily: 'var(--f-ui)',
          fontSize: 15,
          fontWeight: 600,
          lineHeight: '17px',
          color: 'var(--c-on-ribbon)',
          background,
          border: 0,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: '.5px',
            color: 'var(--c-ribbon-label)',
          }}
        >
          закладка
        </span>
        <span>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--c-ribbon-label)' }}>
          {current.label}
        </span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 5,
            width: 240,
            maxHeight: 320,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--c-tab)',
            border: '3px solid var(--c-parchment-edge)',
          }}
        >
          {[all, ...choices].map((choice) => (
            <button
              key={choice.value ?? ''}
              type="button"
              aria-pressed={choice.value === selected}
              onClick={() => {
                onSelect(choice.value)
                setOpen(false)
              }}
              style={{
                padding: '9px 14px',
                textAlign: 'left',
                fontFamily: 'var(--f-ui)',
                fontSize: 15,
                fontWeight: choice.value === selected ? 600 : 400,
                color: 'var(--c-parchment)',
                background: choice.value === selected ? 'var(--c-parchment-edge)' : 'transparent',
                border: 0,
                cursor: 'pointer',
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Различные значения поля в порядке первого появления; выбранное остаётся в списке, даже если записи вытеснены
function distinct(log: LogEntry[], field: 'portal' | 'world', selected?: string): Choice[] {
  const seen = new Set<string>()
  for (const entry of log) {
    const value = entry[field]
    if (value !== null) seen.add(value)
  }
  if (selected !== undefined) seen.add(selected)
  return [...seen].map((value) => ({ value, label: value }))
}

/** Книга журнала: записи на развороте, листание и закладки-фильтры (docs/spec.md §8, §9, кадры 13–14). */
export function JournalScreen() {
  const log = useLabSelector((state) => state.lab.log)
  const [kind, setKind] = useState<LogKind>()
  const [portal, setPortal] = useState<string>()
  const [world, setWorld] = useState<string>()
  // Индекс открытого разворота; null — новейший, книга следует за ним
  const [viewed, setViewed] = useState<number | null>(null)

  // «Пишется» только запись, появившаяся при открытой книге (сравнение по ссылке на запись)
  const newest = log.at(-1) ?? null
  const [seen, setSeen] = useState(newest)
  const [writing, setWriting] = useState<Writing | null>(null)
  const [writes, setWrites] = useState(0)
  if (newest !== seen) {
    setSeen(newest)
    setWriting(newest === null ? null : { entry: newest, id: writes + 1 })
    setWrites(writes + 1)
  }

  const entries = filterLog(log, { kind, portal, world })
  const spreads = Math.max(1, Math.ceil(entries.length / SPREAD_SIZE))
  const spread = viewed === null ? spreads - 1 : Math.min(viewed, spreads - 1)
  const start = spread * SPREAD_SIZE
  const leftEntries = entries.slice(start, start + PAGE_SIZE)
  const rightEntries = entries.slice(start + PAGE_SIZE, start + SPREAD_SIZE)

  // Листание и смена фильтра: анимация письма не повторяется на других страницах
  function flip(to: number) {
    setWriting(null)
    setViewed(to >= spreads - 1 ? null : to)
  }
  function pick<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setWriting(null)
      setViewed(null)
    }
  }

  const ribbons = [
    {
      label: 'Вид записи',
      allLabel: 'все виды',
      background: 'var(--c-ribbon-rejection)',
      choices: KIND_ORDER.map((k) => ({ value: k as string, label: KINDS[k].label })),
      selected: kind,
      onSelect: pick((value: string | undefined) => setKind(value as LogKind | undefined)),
    },
    {
      label: 'Портал',
      allLabel: 'любой',
      background: 'var(--c-ribbon-portal)',
      choices: distinct(log, 'portal', portal),
      selected: portal,
      onSelect: pick(setPortal),
    },
    {
      label: 'Мир',
      allLabel: 'любой',
      background: 'var(--c-ribbon-world)',
      choices: distinct(log, 'world', world),
      selected: world,
      onSelect: pick(setWorld),
    },
  ]

  return (
    <main
      // Отступы и направление (книга, справа закладки) — в классе journal: на узком экране
      // закладки уходят под книгу
      className="journal"
      style={{
        flex: '1 1 auto',
        boxSizing: 'border-box',
        display: 'flex',
        backgroundColor: 'var(--c-desk)',
        backgroundImage:
          'repeating-linear-gradient(90deg,transparent 0 79px,var(--c-desk-seam-v) 79px 80px),repeating-linear-gradient(0deg,transparent 0 23px,var(--c-desk-seam-h) 23px 24px)',
        boxShadow: 'inset 0 0 160px rgba(0,0,0,.75)',
      }}
    >
      <div
        style={{
          flex: '1 1 0',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          alignItems: 'center',
        }}
      >
        <div
          className="journal-head"
          style={{
            display: 'flex',
            width: '100%',
            maxWidth: 1180,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--f-pixel)',
              fontSize: 20,
              fontWeight: 400,
              color: 'var(--c-cellar-title)',
              letterSpacing: 1,
            }}
          >
            КНИГА ЖУРНАЛА
          </h1>
          <span style={{ fontSize: 15, color: 'var(--c-cellar-label)' }}>
            разворот {spread + 1} · записей: {entries.length}
          </span>
        </div>

        <div
          // Высота разворота (7 строк по 80 px и поля) и направление — в классе journal-book
          className="journal-book"
          style={{
            position: 'relative',
            display: 'flex',
            width: '100%',
            maxWidth: 1180,
            flex: '1 1 0',
            boxShadow: '0 0 0 5px var(--c-book-cover), 0 10px 0 5px var(--c-book-cover-shadow)',
          }}
        >
          <Page
            number={spread * 2 + 1}
            side="left"
            entries={leftEntries}
            writing={writing}
            onWritten={() => setWriting(null)}
          />
          <div aria-hidden="true" className="journal-spine" style={{ flex: 'none' }} />
          <Page
            number={spread * 2 + 2}
            side="right"
            entries={rightEntries}
            writing={writing}
            onWritten={() => setWriting(null)}
          >
            {entries.length === 0 && <EmptyBook filtered={log.length > 0} />}
          </Page>
        </div>

        <div
          className="journal-flip"
          style={{
            display: 'flex',
            width: '100%',
            maxWidth: 1180,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          {/* Отступление от кадров 13–14: там у кнопок нет неактивного вида. Листать дальше
              первого и последнего разворота некуда, поэтому кнопка выключена и приглушена */}
          <button
            type="button"
            aria-label="Предыдущий разворот"
            className="journal-flip-button"
            disabled={spread === 0}
            onClick={() => flip(spread - 1)}
            style={{
              ...flipButton,
              opacity: spread === 0 ? 0.45 : 1,
              cursor: spread === 0 ? 'default' : 'pointer',
            }}
          >
            ‹ листать назад
          </button>
          <Legend />
          <button
            type="button"
            aria-label="Следующий разворот"
            className="journal-flip-button"
            disabled={spread === spreads - 1}
            onClick={() => flip(spread + 1)}
            style={{
              ...flipButton,
              opacity: spread === spreads - 1 ? 0.45 : 1,
              cursor: spread === spreads - 1 ? 'default' : 'pointer',
            }}
          >
            листать вперёд ›
          </button>
        </div>
      </div>

      <div
        // Столбец закладок справа от книги; на узком экране — строка под книгой (класс journal-ribbons)
        className="journal-ribbons"
        style={{
          flex: 'none',
          display: 'flex',
          gap: 12,
        }}
      >
        {ribbons.map((ribbon) => (
          <Ribbon key={ribbon.label} {...ribbon} />
        ))}
      </div>
    </main>
  )
}
