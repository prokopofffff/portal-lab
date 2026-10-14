import { risk, type RiskLevel } from '../theme/tokens'
import { cellsFromArt, cellsToPath } from './pixels'
import './sprites.css'

// Глифы 7×7: чем выше риск, тем острее и тревожнее форма.
const glyphs: Record<RiskLevel, readonly string[]> = {
  // ромб — ровно и спокойно
  low: ['...#...', '..#.#..', '.#...#.', '#.....#', '.#...#.', '..#.#..', '...#...'],
  // ромб, рассечённый чертой
  medium: ['...#...', '..###..', '.#.#.#.', '#..#..#', '.#.#.#.', '..###..', '...#...'],
  // треугольник-предупреждение с восклицанием
  high: ['...#...', '..#.#..', '..###..', '.#.#.#.', '.#...#.', '#..#..#', '#######'],
  // взрыв-звезда
  critical: ['#..#..#', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '#..#..#'],
}

const paths: Record<RiskLevel, string> = {
  low: cellsToPath(cellsFromArt(glyphs.low)),
  medium: cellsToPath(cellsFromArt(glyphs.medium)),
  high: cellsToPath(cellsFromArt(glyphs.high)),
  critical: cellsToPath(cellsFromArt(glyphs.critical)),
}

/** Руна уровня риска: своя пиксельная форма на каждый уровень. */
export function Rune({ level, size = 14 }: { level: RiskLevel; size?: number }) {
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
      <path d={paths[level]} fill={risk[level].c} />
    </svg>
  )
}
