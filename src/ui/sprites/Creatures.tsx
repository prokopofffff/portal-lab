import { colors } from '../theme/tokens'
import { cellsFromArt, cellsToPath } from './pixels'
import './sprites.css'

// Три силуэта 8×8 по очереди, чтобы ряд не выглядел штампом.
const bodies = [
  // жук
  ['.#....#.', '..#..#..', '.######.', '##.##.##', '########', '.######.', '.#.##.#.', '#..##..#'],
  // слизень с рожками
  ['..#..#..', '..#..#..', '.######.', '##.##.##', '########', '########', '.######.', '##.##.##'],
  // летун
  ['#......#', '##....##', '###..###', '########', '.#.##.#.', '..####..', '...##...', '..#..#..'],
].map((art) => cellsToPath(cellsFromArt(art)))

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Ряд силуэтов существ мира: изученные проявлены, остальные — тёмные «?». */
export function Creatures({ total, studied }: { total: number; studied: number }) {
  const count = Math.max(0, Math.floor(total))
  const known = clamp(Math.floor(studied), 0, count)

  if (count === 0) {
    return (
      <div className="px-creatures" role="img" aria-label="Существ нет">
        <span className="px-creatures__none">Существ нет</span>
      </div>
    )
  }

  return (
    <div className="px-creatures" role="img" aria-label={`Изучено ${known} из ${count}`}>
      {Array.from({ length: count }, (_, i) => {
        const isKnown = i < known
        return (
          <span key={i} className="px-creature" data-studied={isKnown}>
            <svg viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
              <path d={bodies[i % bodies.length]} fill={isKnown ? colors.textSoft : colors.edge} />
            </svg>
            {!isKnown && <span className="px-creature__mark">?</span>}
          </span>
        )
      })}
    </div>
  )
}
