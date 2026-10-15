import type { CSSProperties } from 'react'
import { useDispatch, useLabSelector, useSpeed } from '../../app/hooks'
import { SPEEDS, type Speed } from '../../app/store'
import { hireRejection, summarize } from '../../domain'
import {
  hireProgress,
  hudStats,
  observerSlots,
  SLOT_TEXT,
  type HudStat,
  type SlotKind,
} from './hudSlots'
import './hud.css'

const caption: CSSProperties = { fontSize: 13, letterSpacing: 1, color: 'var(--c-text-muted)' }
const column: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

// Песочные часы 9×11 из канваса; падающая песчинка — .hg-grain
function Hourglass() {
  return (
    <svg viewBox="0 0 9 11" width={36} height={44} shapeRendering="crispEdges" aria-hidden="true">
      <path d="M0,0h9v1h-9z M0,10h9v1h-9z" fill="var(--s-hourglass-frame)" />
      <path
        d="M1,1h1v2h-1z M7,1h1v2h-1z M2,3h1v1h-1z M6,3h1v1h-1z M3,4h1v1h-1z M5,4h1v1h-1z M3,6h1v1h-1z M5,6h1v1h-1z M2,7h1v1h-1z M6,7h1v1h-1z M1,8h1v2h-1z M7,8h1v2h-1z"
        fill="var(--s-hourglass-glass)"
      />
      <path d="M2,1h5v1h-5z M3,2h3v1h-3z M4,3h1v1h-1z" fill="var(--c-torch)" />
      <path d="M3,9h3v1h-3z M2,8h5v1h-5z M4,7h1v1h-1z" fill="var(--c-torch)" />
      <rect className="hg-grain" x={4} y={4} width={1} height={2} fill="var(--c-torch-light)" />
    </svg>
  )
}

function Clock({ time }: { time: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 150 }}>
      <Hourglass />
      <div style={column}>
        <span style={caption}>ВРЕМЯ</span>
        <span
          style={{
            fontFamily: 'var(--f-ui)',
            fontWeight: 600,
            fontSize: 26,
            lineHeight: '26px',
            color: 'var(--c-torch-light)',
          }}
        >
          мин{' '}
          <span style={{ fontFamily: 'var(--f-pixel)', fontWeight: 400, fontSize: 20 }}>
            {time}
          </span>
        </span>
      </div>
    </div>
  )
}

const speedLabel = (s: Speed) => (s === 0 ? 'Пауза' : `Скорость ×${s}`)

// Активная пауза — синяя, активная скорость — факел (renderVals канваса)
function speedStyle(on: boolean, paused: boolean): CSSProperties {
  return {
    width: 42,
    height: 44,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--f-pixel)',
    fontSize: 11,
    color: on ? 'var(--c-on-torch)' : 'var(--c-text-soft)',
    background: on ? (paused ? 'var(--c-pause-on)' : 'var(--c-torch)') : 'var(--c-control)',
    border: `3px solid ${on ? (paused ? 'var(--c-pause-on-edge)' : 'var(--c-torch-light)') : 'var(--c-edge-strong)'}`,
    boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.35)',
    cursor: 'pointer',
    padding: 0,
  }
}

function SpeedControl() {
  const [speed, setSpeed] = useSpeed()
  const paused = speed === 0
  return (
    <div style={column}>
      <span style={caption}>СКОРОСТЬ{paused ? ' · ПАУЗА' : ''}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {SPEEDS.map((s) => {
          const on = s === speed
          return (
            <button
              key={s}
              type="button"
              aria-label={speedLabel(s)}
              aria-pressed={on}
              style={speedStyle(on, paused)}
              onClick={() => setSpeed(s)}
            >
              {s === 0 ? (
                <svg
                  viewBox="0 0 7 8"
                  width={14}
                  height={16}
                  shapeRendering="crispEdges"
                  aria-hidden="true"
                >
                  <path
                    d="M0,0h3v8h-3z M4,0h3v8h-3z"
                    fill={on ? 'var(--c-on-torch)' : 'var(--c-text-soft)'}
                  />
                </svg>
              ) : (
                <span>×{s}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Вид слота по канвасу: капюшон, фон, рамка, прозрачность, цвет подписи
const SLOT_LOOK: Record<
  SlotKind,
  { hood: string; bg: string; bd: string; bs: 'solid' | 'dashed'; op: number; tc: string }
> = {
  free: {
    hood: 'var(--c-observer-free)',
    bg: 'var(--c-observer-free-bg)',
    bd: 'var(--c-observer-free)',
    bs: 'solid',
    op: 1,
    tc: 'var(--c-text-soft)',
  },
  onsite: {
    hood: 'var(--c-observer-on-site)',
    bg: 'var(--c-observer-on-site-bg)',
    bd: 'var(--c-observer-on-site)',
    bs: 'solid',
    op: 1,
    tc: 'var(--c-text-soft)',
  },
  transit: {
    hood: 'var(--c-observer-transit)',
    bg: 'var(--c-control)',
    bd: 'var(--c-observer-transit-edge)',
    bs: 'solid',
    op: 0.5,
    tc: 'var(--c-text-muted)',
  },
  empty: {
    hood: 'var(--c-edge-strong)',
    bg: 'var(--c-well)',
    bd: 'var(--c-edge)',
    bs: 'dashed',
    op: 1,
    tc: 'var(--c-text-dim)',
  },
}

function Slot({ kind, progress }: { kind: SlotKind; progress: number }) {
  const look = SLOT_LOOK[kind]
  return (
    <div
      role="img"
      aria-label={SLOT_TEXT[kind].aria}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        width: 64,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 44,
          height: 44,
          boxSizing: 'border-box',
          background: look.bg,
          border: `3px ${look.bs} ${look.bd}`,
          opacity: look.op,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {kind !== 'empty' && (
          <svg
            viewBox="0 0 8 8"
            width={32}
            height={32}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <path
              d="M2,0h4v1h-4z M1,1h6v1h-6z M1,2h1v3h-1z M6,2h1v3h-1z M1,5h6v1h-6z M0,6h8v2h-8z"
              fill={look.hood}
            />
            <path d="M2,2h4v3h-4z" fill="var(--s-slot-face)" />
            <path d="M2,3h1v1h-1z M5,3h1v1h-1z" fill="var(--c-on-torch)" />
          </svg>
        )}
        {kind === 'onsite' && (
          <div
            style={{
              position: 'absolute',
              right: -8,
              bottom: -8,
              width: 18,
              height: 18,
              boxSizing: 'border-box',
              background: 'var(--c-well)',
              border: `2px solid ${look.bd}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              viewBox="0 0 6 7"
              width={10}
              height={12}
              shapeRendering="crispEdges"
              aria-hidden="true"
            >
              <path
                d="M2,0h2v1h-2z M1,1h1v1h-1z M4,1h1v1h-1z M0,2h1v5h-1z M5,2h1v5h-1z"
                fill="var(--s-slot-portal-edge)"
              />
              <path d="M1,2h4v5h-4z" fill="var(--s-slot-portal)" />
            </svg>
          </div>
        )}
      </div>
      <span style={{ fontSize: 13, lineHeight: '14px', color: look.tc, whiteSpace: 'nowrap' }}>
        {SLOT_TEXT[kind].text}
      </span>
      {kind === 'transit' && (
        <div
          className="hud-hire-bar"
          style={{
            // Канвас считает рамку снаружи 44×5 (content-box), глобальный border-box её бы съел
            boxSizing: 'content-box',
            width: 44,
            height: 5,
            background: 'var(--c-well)',
            border: '1px solid var(--s-stone-light)',
          }}
        >
          <div
            style={{
              width: `${Math.round(progress * 100)}%`,
              height: '100%',
              background: 'var(--c-torch)',
            }}
          />
        </div>
      )}
    </div>
  )
}

function Lost({ lost }: { lost: number }) {
  return (
    <div
      role="img"
      aria-label={`Потеряно наблюдателей: ${lost}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        width: 64,
        marginLeft: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44 }}>
        <svg
          viewBox="0 0 8 9"
          width={28}
          height={32}
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          <path d="M2,0h4v1h-4z M1,1h6v8h-6z" fill="var(--s-tombstone)" />
          <path d="M3,2h2v1h-2z M2,3h4v1h-4z M3,4h2v3h-2z" fill="var(--s-tombstone-mark)" />
        </svg>
        <span
          style={{
            fontFamily: 'var(--f-pixel)',
            fontSize: 14,
            color: 'var(--c-lost-count)',
            paddingBottom: 4,
          }}
        >
          ×{lost}
        </span>
      </div>
      <span style={{ fontSize: 13, lineHeight: '14px', color: 'var(--c-text-muted)' }}>
        потеряно
      </span>
    </div>
  )
}

// «Нанять»: при недоступности приглушена и с причиной в подсказке, но кликабельна (spec §5)
function HireButton({ rejection }: { rejection: string | null }) {
  const dispatch = useDispatch()
  return (
    <button
      type="button"
      title={rejection ?? undefined}
      aria-disabled={rejection !== null ? true : undefined}
      onClick={() => dispatch({ type: 'hireObserver' })}
      style={{
        alignSelf: 'flex-start',
        marginLeft: 4,
        height: 44,
        padding: '0 12px',
        boxSizing: 'border-box',
        fontFamily: 'var(--f-ui)',
        fontWeight: 600,
        fontSize: 15,
        color: 'var(--c-on-torch)',
        background: 'var(--c-torch)',
        border: '3px solid var(--c-torch-light)',
        boxShadow: 'inset 0 -4px 0 var(--c-torch-deep)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: rejection !== null ? 0.5 : 1,
      }}
    >
      <svg viewBox="0 0 7 7" width={14} height={14} shapeRendering="crispEdges" aria-hidden="true">
        <path d="M3,0h1v7h-1z M0,3h7v1h-7z" fill="var(--c-on-torch)" />
      </svg>
      Нанять
    </button>
  )
}

// Подсветка счётчика (renderVals канваса): рамка, цвет числа и подписи
const STAT_LOOK: Record<'base' | 'high' | 'critical', { bd: string; lc: string; vc: string }> = {
  base: { bd: 'var(--c-edge)', lc: 'var(--c-text-muted)', vc: 'var(--c-text)' },
  high: { bd: 'var(--risk-high-c)', lc: 'var(--c-text-muted)', vc: 'var(--c-stat-high)' },
  critical: {
    bd: 'var(--risk-critical-c)',
    lc: 'var(--c-stat-critical-label)',
    vc: 'var(--c-stat-critical)',
  },
}

function Stat({ label, value, alert }: HudStat) {
  const look = STAT_LOOK[alert ?? 'base']
  return (
    <div
      data-alert={alert ?? undefined}
      style={{
        height: 46,
        boxSizing: 'border-box',
        padding: '4px 8px',
        background: 'var(--c-well)',
        border: `3px solid ${look.bd}`,
        boxShadow: 'inset 0 3px 0 rgba(255,255,255,.05)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      <dt style={{ fontSize: 12, lineHeight: '12px', color: look.lc }}>{label}</dt>
      <dd
        style={{
          margin: 0,
          fontFamily: 'var(--f-pixel)',
          fontSize: 13,
          lineHeight: '13px',
          color: look.vc,
        }}
      >
        {value}
      </dd>
    </div>
  )
}

/** HUD смотрителя (канвас 17-c-hud): время, скорость, штат и сводка из store. */
export function Hud() {
  const lab = useLabSelector((state) => state.lab)
  const [speed] = useSpeed()
  const paused = speed === 0
  const summary = summarize(lab)
  const progress = hireProgress(lab.staff.hireTicksLeft)
  return (
    <header
      className={paused ? 'hud-paused' : 'hud-live'}
      style={{
        // Spec §9: HUD всегда виден — прилипает к верху при прокрутке экрана
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flex: 'none',
        width: '100%',
        boxSizing: 'border-box',
        height: 112,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 20px',
        background: 'var(--c-panel)',
        borderBottom: '4px solid var(--c-edge)',
        boxShadow: 'inset 0 -4px 0 var(--c-well)',
        fontFamily: 'var(--f-ui)',
        color: 'var(--c-text)',
        filter: paused ? 'brightness(.72) saturate(.7)' : 'none',
      }}
    >
      <Clock time={lab.time} />
      <SpeedControl />
      <div
        style={{ width: 4, alignSelf: 'stretch', margin: '18px 0', background: 'var(--c-divider)' }}
      />
      <div style={column}>
        <span style={caption}>НАБЛЮДАТЕЛИ</span>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {observerSlots(summary.staff).map((kind, i) => (
            <Slot key={i} kind={kind} progress={progress} />
          ))}
          <Lost lost={summary.staff.lost} />
          <HireButton rejection={hireRejection(lab)} />
        </div>
      </div>
      <div style={{ flex: '1 1 0', minWidth: 0 }} />
      <dl
        style={{
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
          gap: 6,
          width: 420,
        }}
      >
        {hudStats(summary).map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </dl>
    </header>
  )
}
