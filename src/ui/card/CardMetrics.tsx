import type { CSSProperties, ReactNode } from 'react'
import { Bar } from '../sprites'
import type { CardMetric, CardValues, PortalCardModel } from './cardModel'

// Метрики и разбор риска карточки портала (канвас 23-c-portal-card).

/**
 * Замороженная пара значений до и сразу после команды (как их показала карточка): под изменившимися
 * метриками — «было X, стало Y», у балла — чип изменения. Обе цифры не идут за симуляцией.
 */
export type CardDelta = { before: CardValues; after: CardValues }

/** Цвета карточки: рамка и балл, плашка риска и текст на ней; у архивной — серые. */
export interface CardPalette {
  rc: string
  dark: string
  tx: string
}

const pixel: CSSProperties = { fontFamily: 'var(--f-pixel)' }

// Иконки метрик 7×7 (stats канваса)
const METRICS: {
  key: keyof PortalCardModel['metrics']
  label: string
  icon: string
  color: string
  shown: (value: number) => string
}[] = [
  {
    key: 'energy',
    label: 'Энергия',
    icon: 'M4,0h2v1h-2z M3,1h2v1h-2z M2,2h2v1h-2z M1,3h5v1h-5z M3,4h2v1h-2z M2,5h1v1h-1z M1,6h1v1h-1z',
    color: 'var(--s-study)',
    shown: (v) => String(v),
  },
  {
    key: 'stability',
    label: 'Стабильность',
    icon: 'M1,0h5v1h-5z M0,1h7v4h-7z M1,5h5v1h-5z M2,6h3v1h-3z',
    color: 'var(--risk-low-c)',
    shown: (v) => `${v} %`,
  },
  {
    key: 'timeLeft',
    label: 'До схлопывания',
    icon: 'M0,0h7v1h-7z M1,1h5v1h-5z M2,2h3v1h-3z M3,3h1v1h-1z M2,4h3v1h-3z M1,5h5v1h-5z M0,6h7v1h-7z',
    color: 'var(--c-torch-light)',
    shown: (v) => `${v} мин`,
  },
]

function MetricRow({
  label,
  icon,
  color,
  metric,
  shown,
  change,
}: {
  label: string
  icon: string
  color: string
  metric: CardMetric
  shown: (value: number) => string
  change: { was: number; now: number } | undefined
}) {
  return (
    <>
      <div className="card-bar-row">
        <svg
          viewBox="0 0 7 7"
          width={20}
          height={20}
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          <path d={icon} fill={color} />
        </svg>
        <span className="card-metric-label" style={{ fontSize: 16, color: 'var(--c-text-soft)' }}>
          {label}
        </span>
        <div className="card-bar-row__bar">
          <Bar label={label} value={metric.pct} color={color} segments={20} height={12} />
        </div>
        <span
          className="card-metric-value"
          style={{
            textAlign: 'right',
            fontWeight: 600,
            fontSize: 21,
            lineHeight: '22px',
            color: 'var(--c-row-title)',
          }}
        >
          {shown(metric.value)}
        </span>
      </div>
      {change && change.was !== change.now && (
        <span
          className="card-metric-change"
          style={{
            fontSize: 13,
            color: 'var(--c-observer-on-site-text)',
          }}
        >
          было {shown(change.was)}, стало {shown(change.now)}
        </span>
      )}
    </>
  )
}

/** Три строки метрик; с delta — замороженное «было X, стало Y» под изменившимися. */
export function Metrics({ model, delta }: { model: PortalCardModel; delta?: CardDelta }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '14px 20px 4px' }}>
      {METRICS.map(({ key, ...metric }) => (
        <MetricRow
          key={key}
          {...metric}
          metric={model.metrics[key]}
          change={delta && { was: delta.before[key], now: delta.after[key] }}
        />
      ))}
    </div>
  )
}

/** Чип изменения балла: «▼ −18» зелёный, «▲ +N» красный. */
function ScoreChange({ from, to }: { from: number; to: number }) {
  const diff = to - from
  const down = diff < 0
  return (
    <span
      style={{
        fontSize: 14,
        fontWeight: 600,
        padding: '1px 8px',
        color: down ? 'var(--c-observer-on-site-text)' : 'var(--risk-critical-on)',
        border: `2px solid ${down ? 'var(--c-observer-on-site)' : 'var(--risk-critical-c)'}`,
        background: down ? 'var(--c-accepted-bg)' : 'var(--risk-critical-plate)',
      }}
    >
      <span aria-hidden="true">{down ? `▼ −${-diff}` : `▲ +${diff}`}</span>
      <span className="card-sr">
        {down ? `риск снизился на ${-diff}` : `риск вырос на ${diff}`}
      </span>
    </span>
  )
}

/** Разбор риска: большой балл, части через «+» и «=» итого, печать жёсткого правила. */
export function RiskBox({
  model,
  palette,
  delta,
}: {
  model: PortalCardModel
  palette: CardPalette
  delta: CardDelta | undefined
}) {
  const op: CSSProperties = { ...pixel, fontSize: 14, color: 'var(--c-text-dim)' }
  const parts = [...model.parts, { label: 'итого', value: model.risk.score }]
  return (
    <div
      style={{
        margin: '10px 20px 0',
        padding: '12px 14px',
        background: 'var(--c-row-stage)',
        boxShadow: `inset 0 0 0 3px ${palette.dark}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        className="card-risk-row"
        style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}
      >
        <span style={{ fontSize: 13, letterSpacing: 1, color: 'var(--c-text-muted)' }}>РИСК</span>
        <span style={{ ...pixel, fontSize: 30, lineHeight: '34px', color: palette.rc }}>
          {model.risk.score}
        </span>
        {delta && delta.before.score !== delta.after.score && (
          <ScoreChange from={delta.before.score} to={delta.after.score} />
        )}
        <span className="card-risk-gap" />
        {parts.map((part, i) => (
          <PartGroup key={part.label} first={i === 0} last={i === parts.length - 1} op={op}>
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                minWidth: 78,
                boxSizing: 'content-box',
                padding: '3px 6px',
                background: 'var(--s-sill)',
                boxShadow: 'inset 0 0 0 2px var(--c-edge)',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{part.label}</span>
              <span style={{ ...pixel, fontSize: 14, color: 'var(--c-text)' }}>{part.value}</span>
            </span>
          </PartGroup>
        ))}
      </div>
      {model.hardRule && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 10px',
            background: 'var(--c-hard-rule-bg)',
            border: '3px double var(--risk-critical-c)',
            color: 'var(--risk-critical-on)',
          }}
        >
          <span style={{ ...pixel, fontSize: 10, letterSpacing: 1 }}>ПЕЧАТЬ</span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{model.hardRule}</span>
        </div>
      )}
    </div>
  )
}

// Знак перед частью разбора: «+» между слагаемыми, «=» перед итогом (отдельные элементы flex, как в канвасе)
function PartGroup({
  first,
  last,
  op,
  children,
}: {
  first: boolean
  last: boolean
  op: CSSProperties
  children: ReactNode
}) {
  return (
    <>
      {!first && <span style={op}>{last ? '=' : '+'}</span>}
      {children}
    </>
  )
}
