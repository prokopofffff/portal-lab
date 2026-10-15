import { creatureColors, sprite } from '../theme/tokens'
import { CREATURE_BODIES, UNKNOWN_CREATURE } from './creatureGlyphs'
import './sprites.css'

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
        const body = CREATURE_BODIES[i % CREATURE_BODIES.length]!
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
            {state === 'false' && <Glyph d={UNKNOWN_CREATURE} fill={sprite.unknownGlyph} px={px} />}
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
