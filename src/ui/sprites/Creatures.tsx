import { creatureColors, sprite } from '../theme/tokens'
import './sprites.css'

// Силуэты 8×8 из канваса «Существа мира»: слизень, рогач, призрак, жук — по кругу.
const bodies = [
  'M2,1h4v1h-4z M1,2h6v1h-6z M0,3h2v1h-2z M3,3h2v1h-2z M6,3h2v1h-2z M0,4h8v2h-8z M1,6h1v1h-1z M3,6h2v1h-2z M6,6h1v1h-1z',
  'M0,0h1v1h-1z M7,0h1v1h-1z M0,1h2v1h-2z M6,1h2v1h-2z M1,2h6v1h-6z M1,3h1v1h-1z M3,3h2v1h-2z M6,3h1v1h-1z M1,4h6v1h-6z M2,5h4v1h-4z M1,6h1v1h-1z M3,6h2v1h-2z M6,6h1v1h-1z M1,7h1v1h-1z M6,7h1v1h-1z',
  'M2,0h4v1h-4z M1,1h6v1h-6z M1,2h1v1h-1z M3,2h2v1h-2z M6,2h1v1h-1z M1,3h6v4h-6z M1,7h1v1h-1z M3,7h2v1h-2z M6,7h1v1h-1z',
  'M0,0h1v1h-1z M7,0h1v1h-1z M1,1h1v1h-1z M6,1h1v1h-1z M2,2h4v1h-4z M1,3h6v1h-6z M0,4h2v1h-2z M3,4h2v1h-2z M6,4h2v1h-2z M1,5h6v1h-6z M0,6h1v1h-1z M2,6h1v1h-1z M5,6h1v1h-1z M7,6h1v1h-1z M0,7h1v1h-1z M7,7h1v1h-1z',
] as const
const unknownGlyph = 'M2,0h4v1h-4z M1,1h2v1h-2z M5,1h2v1h-2z M4,2h2v1h-2z M3,3h2v2h-2z M3,6h2v2h-2z'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function Glyph({ d, fill, px, clip }: { d: string; fill: string; px: number; clip?: number }) {
  return (
    <svg
      viewBox="0 0 8 8"
      width={px}
      height={px}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={clip === undefined ? undefined : { clipPath: `inset(${clip}% 0 0 0)` }}
    >
      <path d={d} fill={fill} />
    </svg>
  )
}

/** Клетки существ мира: изученные проявлены, изучаемое проступает снизу, остальные — «?». */
export function Creatures({
  total,
  studied,
  progress = 0,
  size = 32,
}: {
  total: number
  studied: number
  /** Сколько процентов изучено у следующего существа (0..99). */
  progress?: number
  size?: number
}) {
  const count = Math.max(0, Math.floor(total))
  const known = clamp(Math.floor(studied), 0, count)

  if (count === 0) {
    return (
      <div className="px-creatures" role="img" aria-label="Существ нет">
        <span className="px-creatures__none">Существ нет</span>
      </div>
    )
  }

  const full = known === count
  const pct = full ? 0 : clamp(Math.round(progress), 0, 99)
  const px = Math.floor((size - 4) / 8) * 8 || 8
  const label = `Изучено ${known} из ${count}` + (pct > 0 ? `, следующее изучено на ${pct} %` : '')

  return (
    <div className="px-creatures" data-full={full} role="img" aria-label={label}>
      {Array.from({ length: count }, (_, i) => {
        const body = bodies[i % bodies.length]!
        const color = creatureColors[i % creatureColors.length]!
        const state = i < known ? 'true' : i === known && pct > 0 ? 'partial' : 'false'
        return (
          <span
            key={i}
            className="px-creature"
            data-studied={state}
            style={{ width: size, height: size }}
          >
            {state === 'true' && <Glyph d={body} fill={color} px={px} />}
            {state === 'false' && <Glyph d={unknownGlyph} fill={sprite.unknownGlyph} px={px} />}
            {state === 'partial' && (
              <>
                <Glyph d={body} fill={sprite.studyGhost} px={px} />
                <span className="px-creature__reveal">
                  <Glyph d={body} fill={color} px={px} clip={100 - pct} />
                </span>
                <span className="px-creature__badge">{pct}%</span>
              </>
            )}
          </span>
        )
      })}
    </div>
  )
}
