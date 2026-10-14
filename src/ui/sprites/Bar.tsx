import type { RiskLevel } from '../theme/tokens'
import './sprites.css'

const SEGMENTS = 10

/** Сколько сегментов закрасить: пусто только при нуле, полно только при максимуме. */
function filledSegments(value: number, max: number): number {
  if (value <= 0) return 0
  if (value >= max) return SEGMENTS
  return Math.min(SEGMENTS - 1, Math.max(1, Math.round((value / max) * SEGMENTS)))
}

/** Пиксельная полоска из сегментов с подписью и числом. */
export function Bar({
  label,
  value,
  max = 100,
  tone = 'neutral',
}: {
  label: string
  value: number
  max?: number
  tone?: RiskLevel | 'neutral'
}) {
  const clamped = Math.min(max, Math.max(0, value))
  const filled = filledSegments(clamped, max)
  return (
    <div
      className="px-bar"
      data-tone={tone}
      role="meter"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <span className="px-bar__label">{label}</span>
      <span className="px-bar__track">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className="px-bar__seg" data-filled={i < filled} />
        ))}
      </span>
      <span className="px-bar__value">{Math.round(clamped)}</span>
    </div>
  )
}
