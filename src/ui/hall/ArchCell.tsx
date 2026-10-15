import { useId, type AnimationEvent, type CSSProperties, type ReactNode } from 'react'
import { Portal, Rune } from '../sprites'
import { ARCH_OPENING } from '../sprites/Portal'
import { risk, type RiskLevel } from '../theme/tokens'
import type { Departure, PortalCell } from './hallCells'

// Арка и табличка под ней (канвас 00-hall, ячейка сетки 6×2). Размеры и шрифты — из исходника кадра.

const ARCH_W = 100
const PLATE_W = 208

// Сила ореола за аркой по уровню риска (glow в renderVals канваса)
const glowStrength: Record<RiskLevel, string> = {
  low: '16%',
  medium: '18%',
  high: '26%',
  critical: '40%',
}

const cellStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  paddingTop: 2,
}

const bareButton: CSSProperties = {
  padding: 0,
  margin: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  lineHeight: 0,
}

const archBox: CSSProperties = { position: 'relative', width: ARCH_W, height: 117 }

const pixelLabel: CSSProperties = { fontFamily: 'var(--f-pixel)', fontSize: 11 }

// Рамка фокуса вокруг всей ячейки: пунктир у выбранного портала, у остальных прозрачная (ring в канвасе)
function Cell({
  dimmed,
  focused = false,
  children,
}: {
  dimmed: boolean
  focused?: boolean
  children: ReactNode
}) {
  return (
    <div
      style={{
        ...cellStyle,
        opacity: dimmed ? 0.28 : 1,
        outline: focused ? '3px dashed var(--c-torch-light)' : '3px solid transparent',
        outlineOffset: -4,
      }}
    >
      {children}
    </div>
  )
}

/** Полоска таблички: подпись, сегменты через 2 px и число справа. */
function Meter({
  short,
  name,
  pct,
  value,
  shown,
  color,
}: {
  short: string
  name: string
  pct: number
  value: number
  shown: string
  color: string
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 6, height: 18, whiteSpace: 'nowrap' }}
    >
      <span aria-hidden="true" style={{ width: 32, fontSize: 13, color: 'var(--c-text-muted)' }}>
        {short}
      </span>
      <span
        role="meter"
        aria-label={name}
        aria-valuenow={value}
        aria-valuetext={shown}
        style={{ flex: '1 1 0', height: 8, background: 'var(--s-stone-deep)' }}
      >
        <span
          style={{
            display: 'block',
            height: 8,
            width: `${pct}%`,
            background: `repeating-linear-gradient(90deg,${color} 0 8px,transparent 8px 10px)`,
          }}
        />
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 66,
          textAlign: 'right',
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--c-text)',
        }}
      >
        {shown}
      </span>
    </div>
  )
}

function studyText(cell: PortalCell): string {
  const base = `Изучено ${cell.studied} из ${cell.creatures}`
  return cell.nextW > 0 ? `${base}, следующее на ${cell.nextPct} %` : base
}

/** Табличка портала: все поля из spec §9; status — открыт или чем кончился. */
function Plate({
  cell,
  status,
  onAnimationEnd,
}: {
  cell: PortalCell
  status: Departure['status'] | 'open'
  onAnimationEnd?: (e: AnimationEvent<HTMLDivElement>) => void
}) {
  const open = status === 'open'
  const band = open ? risk[cell.level] : risk.archived
  return (
    <div
      className={open ? 'hall-notch' : 'hall-notch hall-leave-plate'}
      onAnimationEnd={onAnimationEnd}
      style={{
        position: 'relative',
        width: PLATE_W,
        boxSizing: 'border-box',
        background: 'var(--s-sill)',
        borderTop: `5px solid ${band.c}`,
        boxShadow: 'inset 0 0 0 3px var(--c-edge-soft)',
        padding: '8px 12px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        marginTop: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 20,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ ...pixelLabel, color: 'var(--c-row-title)' }}>{cell.name}</span>
        {cell.shared && (
          <span
            style={{
              fontSize: 13,
              color: 'var(--c-shared-world)',
              border: '1px solid var(--c-shared-world-edge)',
              padding: '0 5px',
              background: 'var(--c-shared-world-bg)',
            }}
          >
            общий мир
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: 16,
          color: 'var(--c-row-text)',
          lineHeight: '17px',
          height: 17,
          whiteSpace: 'nowrap',
        }}
      >
        {cell.world}
      </span>
      <Meter
        short="ЭНР"
        name="Энергия"
        pct={cell.energy}
        value={cell.energy}
        shown={String(cell.energy)}
        color="var(--s-study)"
      />
      <Meter
        short="СТБ"
        name="Стабильность"
        pct={cell.stability}
        value={cell.stability}
        shown={`${cell.stability} %`}
        color="var(--risk-low-c)"
      />
      <Meter
        short="ВРМ"
        name="Время до схлопывания"
        pct={cell.timePct}
        value={cell.timeLeft}
        shown={`${cell.timeLeft} мин`}
        color="var(--c-torch-light)"
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 6,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--c-row-text)',
          whiteSpace: 'nowrap',
          marginTop: 2,
        }}
      >
        <span>изучено существ</span>
        <b style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
          {cell.studied} / {cell.creatures}
        </b>
      </div>
      <div
        role="img"
        aria-label={studyText(cell)}
        style={{ display: 'flex', height: 8, background: 'var(--s-stone-deep)' }}
      >
        <span
          style={{
            display: 'block',
            height: 8,
            width: `${cell.doneW}%`,
            background:
              'repeating-linear-gradient(90deg,var(--s-study) 0 8px,transparent 8px 10px)',
          }}
        />
        <span
          style={{
            display: 'block',
            height: 8,
            width: `${cell.nextW}%`,
            background:
              'repeating-linear-gradient(90deg,var(--c-study-next) 0 8px,transparent 8px 10px)',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          margin: '3px -12px 0',
          padding: '5px 12px 6px',
          background: band.plate,
          color: band.onPlate,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}
      >
        <span aria-hidden="true" style={{ display: 'flex' }}>
          <Rune level={open ? cell.level : 'archived'} size={14} />
        </span>
        {open ? (
          <>
            <span className="hall-sr">Открыт, риск </span>
            <span>{band.label.toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span>{cell.score}</span>
          </>
        ) : status === 'closed' ? (
          'ЗАКРЫТ'
        ) : (
          'СХЛОПНУЛСЯ'
        )}
      </div>
    </div>
  )
}

const flagBox: CSSProperties = {
  width: 30,
  height: 30,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

function ObserversBadge({ count }: { count: number }) {
  const label = `Наблюдателей на месте: ${count}`
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '5px 7px 4px',
        background: 'var(--c-observer-on-site-bg)',
        border: '2px solid var(--c-observer-on-site)',
        color: 'var(--c-observer-on-site-text)',
        fontSize: 18,
        fontWeight: 700,
        lineHeight: '18px',
      }}
    >
      <svg viewBox="0 0 9 5" width={27} height={15} shapeRendering="crispEdges" aria-hidden="true">
        <path
          d="M2,0h5v1h-5z M1,1h1v1h-1z M4,1h1v1h-1z M7,1h1v1h-1z M0,2h1v1h-1z M3,2h3v1h-3z M8,2h1v1h-1z M1,3h1v1h-1z M4,3h1v1h-1z M7,3h1v1h-1z M2,4h5v1h-5z"
          fill="currentColor"
        />
      </svg>
      <span>×</span>
      <span>{count}</span>
    </span>
  )
}

function QuestionedFlag() {
  return (
    <span
      title="Под вопросом"
      role="img"
      aria-label="Под вопросом"
      style={{
        ...flagBox,
        background: 'var(--c-questioned-bg)',
        border: '2px solid var(--risk-medium-c)',
      }}
    >
      <svg viewBox="0 0 8 8" width={16} height={16} shapeRendering="crispEdges" aria-hidden="true">
        <path
          d="M2,0h4v1h-4z M1,1h2v1h-2z M5,1h2v1h-2z M4,2h2v1h-2z M3,3h2v2h-2z M3,6h2v2h-2z"
          fill="var(--risk-medium-c)"
        />
      </svg>
    </span>
  )
}

function AcceptedFlag() {
  return (
    <span
      title="Принят как есть"
      role="img"
      aria-label="Принят как есть"
      style={{
        ...flagBox,
        background: 'var(--c-accepted-bg)',
        border: '2px solid var(--c-observer-on-site)',
      }}
    >
      <svg viewBox="0 0 8 8" width={16} height={16} shapeRendering="crispEdges" aria-hidden="true">
        <path
          d="M0,4h1v1h-1z M1,5h1v1h-1z M2,6h1v1h-1z M3,5h1v1h-1z M4,4h1v1h-1z M5,3h1v1h-1z M6,2h1v1h-1z M7,1h1v1h-1z"
          fill="var(--c-observer-on-site)"
        />
      </svg>
    </span>
  )
}

/** Арка с открытым порталом: ореол, наблюдатели слева, пометки справа, табличка снизу. */
export function PortalArch({
  cell,
  dimmed,
  focused,
  onOpen,
}: {
  cell: PortalCell
  dimmed: boolean
  focused: boolean
  onOpen: () => void
}) {
  return (
    <Cell dimmed={dimmed} focused={focused}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -10,
          left: '50%',
          width: 230,
          height: 230,
          marginLeft: -115,
          background: `radial-gradient(closest-side, color-mix(in srgb, ${risk[cell.level].c} ${glowStrength[cell.level]}, transparent), transparent)`,
          pointerEvents: 'none',
        }}
      />
      <div style={archBox}>
        <button
          type="button"
          aria-label={`Открыть карточку портала ${cell.name}`}
          onClick={onOpen}
          style={{ ...bareButton, position: 'absolute', left: 0, top: 0 }}
        >
          <Portal look={cell.level} observers={cell.observers} width={ARCH_W} />
        </button>
        <div
          style={{
            position: 'absolute',
            right: 'calc(100% + 6px)',
            top: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: 'flex-end',
          }}
        >
          {cell.observers > 0 && <ObserversBadge count={cell.observers} />}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 'calc(100% + 12px)',
            top: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: 'flex-start',
          }}
        >
          {cell.questioned && <QuestionedFlag />}
          {cell.accepted && <AcceptedFlag />}
        </div>
      </div>
      <Plate cell={cell} status="open" />
    </Cell>
  )
}

/** Пустая арка: тлеют руны, клик открывает портал. У первой арки пустого зала — подсказка. */
export function EmptyArch({
  arch,
  invite,
  dimmed,
  onOpenPortal,
}: {
  arch: number
  invite: boolean
  dimmed: boolean
  onOpenPortal: () => void
}) {
  const label = `АРКА ${arch + 1}`
  const hint = invite ? 'нажмите — откроется портал' : 'пуста'
  const text = invite ? 'var(--c-torch-light)' : 'var(--c-text-dim)'
  return (
    <Cell dimmed={dimmed}>
      <button
        type="button"
        aria-label={`Арка ${arch + 1} пуста — открыть портал`}
        onClick={onOpenPortal}
        style={{ ...bareButton, position: 'relative' }}
      >
        <Portal look="empty" width={ARCH_W} />
      </button>
      <div
        aria-hidden="true"
        style={{
          marginTop: 10,
          width: PLATE_W,
          boxSizing: 'border-box',
          padding: '10px 12px',
          border: `2px dashed ${invite ? 'var(--c-torch)' : 'var(--c-edge-soft)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <span style={{ ...pixelLabel, color: text }}>{label}</span>
        <span style={{ fontSize: 14, color: text }}>{hint}</span>
      </div>
    </Cell>
  )
}

// Кладка 16×22 внутри проёма: швы рядов и вертикальные стыки вперевязку
const SLAB_JOINTS =
  'M4,8h16v1h-16z M4,11h16v1h-16z M4,14h16v1h-16z M4,17h16v1h-16z M4,20h16v1h-16z M4,23h16v1h-16z M4,26h16v1h-16z' +
  ' M12,5h1v3h-1z M8,9h1v2h-1z M16,9h1v2h-1z M6,12h1v2h-1z M12,12h1v2h-1z M18,12h1v2h-1z' +
  ' M9,15h1v2h-1z M15,15h1v2h-1z M6,18h1v2h-1z M12,18h1v2h-1z M18,18h1v2h-1z' +
  ' M9,21h1v2h-1z M15,21h1v2h-1z M6,24h1v2h-1z M12,24h1v2h-1z M18,24h1v2h-1z'
// Печать 5×5 по центру проёма
const SEAL_STAMP = 'M11,13h3v1h-3z M10,14h1v3h-1z M14,14h1v3h-1z M12,15h1v1h-1z M11,17h3v1h-3z'

/** Кладка, которая опускается в проём при закрытии портала. */
function SealSlab() {
  const clip = useId()
  return (
    <svg
      className="hall-seal"
      viewBox="0 0 24 28"
      width={ARCH_W}
      height={117}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <path d={ARCH_OPENING} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <g className="hall-seal__slab">
          <rect x={4} y={5} width={16} height={22} fill="var(--s-arch-stone)" />
          <rect x={4} y={26} width={16} height={1} fill="var(--s-stone-light)" />
          <path d={SLAB_JOINTS} fill="var(--s-stone-deep)" />
        </g>
        <path className="hall-seal__stamp" d={SEAL_STAMP} fill="var(--c-torch)" />
      </g>
    </svg>
  )
}

/**
 * Портал уходит из арки (бриф: «схлопывание — портал сжимается и гаснет, закрытие — арку
 * запечатывают»). Под ним уже пустая арка; когда табличка дотает, onDone убирает сцену.
 */
export function LeavingArch({
  departure,
  dimmed,
  onDone,
}: {
  departure: Departure
  dimmed: boolean
  onDone: () => void
}) {
  const { cell, status } = departure
  const end = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onDone()
  }
  return (
    <Cell dimmed={dimmed}>
      <div className="hall-leaving" data-leaving={status} aria-hidden="true">
        <Portal look="empty" width={ARCH_W} />
        <div
          className={
            status === 'collapsed' ? 'hall-opening hall-collapse' : 'hall-opening hall-seal-portal'
          }
        >
          <Portal look={cell.level} width={ARCH_W} />
        </div>
        {status === 'closed' && <SealSlab />}
      </div>
      <Plate cell={cell} status={status} onAnimationEnd={end} />
    </Cell>
  )
}
