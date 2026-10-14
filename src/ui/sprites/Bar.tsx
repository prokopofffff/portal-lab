import type { CSSProperties } from 'react'
import './sprites.css'

/** Пиксельная полоска: только дорожка из сегментов. Подпись и число рисует потребитель рядом. */
export function Bar({
  label,
  value,
  max = 100,
  color = 'var(--risk-low-c)',
  segments = 10,
  height = 10,
}: {
  /** Доступное имя полоски; на экран не выводится. */
  label: string
  value: number
  max?: number
  /** Цвет зажжённых сегментов: CSS-переменная токена. */
  color?: string
  segments?: number
  height?: number
}) {
  const clamped = Math.min(max, Math.max(0, value))
  // Как в канвасе: округление вверх, чтобы любое ненулевое значение зажигало сегмент.
  const lit = clamped > 0 ? Math.ceil((clamped / max) * segments - 0.001) : 0
  return (
    <div
      className="px-bar"
      style={{ '--px-bar-fill': color } as CSSProperties}
      role="meter"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className="px-bar__seg" data-lit={i < lit} style={{ height }} />
      ))}
    </div>
  )
}
