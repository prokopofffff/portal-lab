import { useId, useState, type CSSProperties } from 'react'
import { Bar, Creatures } from '../sprites'
import type { CardAdvice, CardHistoryEntry, PortalCardModel } from './cardModel'

// Нижняя половина карточки портала (канвас 23-c-portal-card): изучение мира, совет, история.

const caption: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 400,
  letterSpacing: 1,
  color: 'var(--c-text-muted)',
}

// Ширина подписи и значения строки — в классах card-study-label / card-study-value (узкий экран)
const rowLabel: CSSProperties = { fontSize: 15, color: 'var(--c-text-soft)' }

const rowValue: CSSProperties = {
  textAlign: 'right',
  fontWeight: 600,
  fontSize: 18,
  color: 'var(--c-row-title)',
}

// «открытый портал» / «открытых портала» / «открытых порталов» по числу
function openPortalsNoun(n: number): string {
  const lastTwo = n % 100
  const last = n % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'открытых порталов'
  if (last === 1) return 'открытый портал'
  if (last >= 2 && last <= 4) return 'открытых портала'
  return 'открытых порталов'
}

// Фигурка наблюдателя в слоте «На месте»
function SlotObserver() {
  return (
    <svg viewBox="0 0 8 8" width={26} height={26} shapeRendering="crispEdges" aria-hidden="true">
      <path
        d="M2,0h4v1h-4z M1,1h6v1h-6z M1,2h1v3h-1z M6,2h1v3h-1z M1,5h6v1h-6z M0,6h8v2h-8z"
        fill="var(--c-observer-on-site)"
      />
      <path d="M2,2h4v3h-4z" fill="var(--s-slot-face)" />
      <path d="M2,3h1v1h-1z M5,3h1v1h-1z" fill="var(--c-on-torch)" />
    </svg>
  )
}

/** Изучение мира: счёт, полоска мира, существа, изучаемое существо, наблюдатели, другие порталы. */
export function Study({
  model,
  onOpenPortal,
}: {
  model: PortalCardModel
  onOpenPortal: (name: string) => void
}) {
  const { study } = model
  const open = model.status === 'open'
  const others = study.others
  const linkStyle: CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--c-shared-world)',
  }
  return (
    <section style={{ margin: '10px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        className="card-study-head"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <h3 style={caption}>ИЗУЧЕНИЕ МИРА</h3>
        <span style={{ fontSize: 17, color: 'var(--c-text)' }}>
          в мире изучено{' '}
          <b style={{ fontSize: 20, fontWeight: 600, color: 'var(--c-torch-light)' }}>
            {study.studied} из {study.creatures}
          </b>
        </span>
      </div>
      <div className="card-bar-row">
        <span className="card-study-label" style={rowLabel}>
          Прогресс мира
        </span>
        <div className="card-bar-row__bar">
          <Bar
            label="Прогресс мира"
            value={study.worldPct}
            color="var(--c-torch-light)"
            segments={study.creatures}
            height={12}
          />
        </div>
        <span className="card-study-value" style={rowValue}>
          {study.worldPct} %
        </span>
      </div>
      <Creatures
        total={study.creatures}
        studied={study.studied}
        progress={study.current?.pct ?? 0}
        size={40}
      />
      {study.current && (
        <div className="card-bar-row">
          <span className="card-study-label" style={rowLabel}>
            Изучается существо №{study.current.number}
          </span>
          <div className="card-bar-row__bar">
            <Bar
              label={`Изучается существо №${study.current.number}`}
              value={study.current.pct}
              color="var(--s-study)"
              segments={20}
              height={12}
            />
          </div>
          <span className="card-study-value" style={rowValue}>
            {study.current.pct} %
          </span>
        </div>
      )}
      {open && (
        <div className="card-slots" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="card-study-label card-slots-label" style={rowLabel}>
            На месте
          </span>
          {Array.from({ length: study.maxObservers }, (_, i) => {
            const on = i < study.observers
            return (
              <span
                key={i}
                aria-hidden="true"
                data-testid={on ? 'slot-on' : 'slot-free'}
                style={{
                  width: 36,
                  height: 36,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: on ? 'var(--c-observer-on-site-bg)' : 'var(--c-well)',
                  border: on ? '2px solid var(--c-observer-on-site)' : '2px dashed var(--c-edge)',
                }}
              >
                {on && <SlotObserver />}
              </span>
            )
          })}
          <span style={{ fontSize: 14, color: 'var(--c-text-faint)' }}>
            {study.observers > 0 ? `наблюдателей: ${study.observers}` : 'наблюдателей нет'}
          </span>
        </div>
      )}
      {open && others.length === 1 && (
        <button
          type="button"
          className="card-link card-link--underline"
          onClick={() => onOpenPortal(others[0]!)}
          style={{ ...linkStyle, alignSelf: 'flex-start' }}
        >
          ещё 1 открытый портал в этот мир: {others[0]} <span aria-hidden="true">→</span>
        </button>
      )}
      {open && others.length > 1 && (
        <p style={{ ...linkStyle, margin: 0 }}>
          ещё {others.length} {openPortalsNoun(others.length)} в этот мир:{' '}
          {others.map((name, i) => (
            <span key={name}>
              {i > 0 && ', '}
              <button
                type="button"
                className="card-link card-link--underline"
                onClick={() => onOpenPortal(name)}
                style={linkStyle}
              >
                {name} <span aria-hidden="true">→</span>
              </button>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

/** Пергамент «Совет смотрителю»: действие жирным, за ним причина. */
export function Advice({ advice }: { advice: CardAdvice }) {
  return (
    <section
      className="card-notch"
      style={{
        margin: '14px 20px 0',
        padding: '10px 14px 10px',
        background: 'var(--c-parchment)',
        color: 'var(--c-ink-title)',
        boxShadow: 'inset 0 -4px 0 var(--c-parchment-shade)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <svg
        viewBox="0 0 7 8"
        width={21}
        height={24}
        shapeRendering="crispEdges"
        aria-hidden="true"
        style={{ flex: 'none', marginTop: 2 }}
      >
        <path
          d="M2,0h3v1h-3z M1,1h5v1h-5z M0,2h7v3h-7z M1,5h5v1h-5z M2,6h3v1h-3z M2,7h3v1h-3z"
          fill="var(--s-ember-rune)"
        />
        <path d="M2,2h3v2h-3z" fill="var(--c-torch-light)" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            color: 'var(--c-ink-label)',
          }}
        >
          СОВЕТ СМОТРИТЕЛЮ
        </h3>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--f-prose)',
            fontSize: 17,
            lineHeight: '21px',
            textWrap: 'pretty',
          }}
        >
          {/* text = «<действие> — <причина>»: действие выделяем, остальное как есть */}
          <b>{advice.label}</b>
          {advice.text.slice(advice.label.length)}
        </p>
      </div>
    </section>
  )
}

// Записи истории: действие обычным, система курсивом и тусклее, отказ — цветом отказа
const HISTORY_LOOK: Record<CardHistoryEntry['kind'], CSSProperties> = {
  action: { color: 'var(--c-text)', fontStyle: 'normal' },
  system: { color: 'var(--c-text-faint)', fontStyle: 'italic' },
  rejection: { color: 'var(--c-legend-rejection)', fontStyle: 'normal' },
}

/** Свиток «История портала»: можно свернуть. */
export function History({ history }: { history: CardHistoryEntry[] }) {
  const listId = useId()
  const [expanded, setExpanded] = useState(true)
  return (
    <section
      style={{
        margin: '14px 20px 20px',
        padding: '10px 14px 12px',
        background: 'var(--c-row-stage)',
        boxShadow: 'inset 0 0 0 2px var(--c-edge)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: expanded ? 6 : 0,
        }}
      >
        <h3 style={caption}>ИСТОРИЯ ПОРТАЛА</h3>
        <button
          type="button"
          className="card-link"
          // Имя постоянное, состояние объявляет aria-expanded (в тексте оно повторилось бы)
          aria-label="свиток истории"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
          style={{ fontSize: 13, color: 'var(--c-text-faint)' }}
        >
          {expanded ? 'свиток развёрнут ▾' : 'свиток свёрнут ▸'}
        </button>
      </div>
      <ol
        id={listId}
        hidden={!expanded}
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: expanded ? 'flex' : 'none',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {history.map((entry) => (
          <li key={entry.key} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <span
              style={{
                flex: 'none',
                width: 72,
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--c-text-faint)',
              }}
            >
              мин {entry.time}
            </span>
            <span
              style={{
                fontFamily: 'var(--f-prose)',
                fontSize: 16,
                lineHeight: '20px',
                ...HISTORY_LOOK[entry.kind],
              }}
            >
              {entry.text}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
