import { risk, sprite, type RiskLevel } from '../theme/tokens'
import './sprites.css'

export type RuneLevel = RiskLevel | 'archived'

// Глифы 7×7 из канваса «Руна риска»: круг, ромб, треугольник, череп и крест закрытого портала.
const glyphs: Record<RuneLevel, string> = {
  low: 'M2,0h3v1h-3z M1,1h1v1h-1z M5,1h1v1h-1z M0,2h1v3h-1z M6,2h1v3h-1z M3,3h1v1h-1z M1,5h1v1h-1z M5,5h1v1h-1z M2,6h3v1h-3z',
  medium:
    'M3,0h1v1h-1z M2,1h1v1h-1z M4,1h1v1h-1z M1,2h1v1h-1z M5,2h1v1h-1z M0,3h1v1h-1z M3,3h1v1h-1z M6,3h1v1h-1z M1,4h1v1h-1z M5,4h1v1h-1z M2,5h1v1h-1z M4,5h1v1h-1z M3,6h1v1h-1z',
  high: 'M3,0h1v1h-1z M2,1h1v2h-1z M4,1h1v2h-1z M1,3h1v2h-1z M3,3h1v2h-1z M5,3h1v2h-1z M0,5h1v1h-1z M6,5h1v1h-1z M0,6h7v1h-7z',
  critical:
    'M1,0h5v1h-5z M0,1h7v1h-7z M0,2h2v1h-2z M3,2h1v1h-1z M5,2h2v1h-2z M0,3h7v1h-7z M1,4h5v1h-5z M1,5h1v1h-1z M3,5h1v1h-1z M5,5h1v1h-1z M2,6h3v1h-3z',
  archived:
    'M0,0h1v1h-1z M6,0h1v1h-1z M1,1h1v1h-1z M5,1h1v1h-1z M2,2h1v1h-1z M4,2h1v1h-1z M3,3h1v1h-1z M2,4h1v1h-1z M4,4h1v1h-1z M1,5h1v1h-1z M5,5h1v1h-1z M0,6h1v1h-1z M6,6h1v1h-1z',
}

const fills: Record<RuneLevel, string> = {
  low: risk.low.c,
  medium: risk.medium.c,
  high: risk.high.c,
  critical: risk.critical.c,
  archived: sprite.deadRune,
}

/** Руна уровня риска: своя пиксельная форма на каждый уровень, у архива — крест. */
export function Rune({ level, size = 16 }: { level: RuneLevel; size?: number }) {
  return (
    <svg
      className="px-rune"
      data-level={level}
      role="img"
      aria-label={risk[level].label}
      viewBox="0 0 7 7"
      width={size}
      height={size}
      shapeRendering="crispEdges"
    >
      <path d={glyphs[level]} fill={fills[level]} />
    </svg>
  )
}
