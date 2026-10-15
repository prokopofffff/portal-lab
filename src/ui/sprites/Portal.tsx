import { CONFIG } from '../../domain'
import { portalShades, risk, sprite, type PortalLook, type RiskLevel } from '../theme/tokens'
import './sprites.css'

// Арка 24×28 из канваса «Арка и портал». Камень одинаков у всех видов; проём — четыре слоя
// оттенков портала от края к ядру; искры поднимаются над порталом, у пустой арки тлеют руны.

const ARCH_OUTLINE = 'M6,0H18V1H20V2H21V3H22V4H23V5H24V28H0V5H1V4H2V3H3V2H4V1H6Z'
/** Проём арки: в нём живёт портал (зал кладёт сюда печать закрытия). */
export const ARCH_OPENING = 'M8,5H16V6H18V7H19V8H20V27H4V8H5V7H6V6H8Z'
const LAYER_2 = 'M9,7H15V8H17V9H18V25H6V9H7V8H9Z'
const LAYER_3 = 'M10,10H14V11H15V12H16V22H8V12H9V11H10Z'
const CORE = 'M11,14H13V15H14V20H10V15H11Z'

type Rect = readonly [x: number, y: number, w: number, h: number, fill: string]

// Грани и швы кладки поверх основного камня.
const stoneDetails: Rect[] = [
  [6, 0, 12, 1, sprite.stoneLight],
  [4, 1, 2, 1, sprite.stoneLight],
  [18, 1, 2, 1, sprite.stoneShadow],
  [0, 5, 1, 22, sprite.stoneLit],
  [23, 5, 1, 22, sprite.stoneDeep],
  [11, 0, 2, 2, sprite.keystone],
  [0, 9, 4, 1, sprite.stoneDeep],
  [0, 15, 4, 1, sprite.stoneDeep],
  [0, 21, 4, 1, sprite.stoneDeep],
  [20, 9, 4, 1, sprite.stoneDeep],
  [20, 15, 4, 1, sprite.stoneDeep],
  [20, 21, 4, 1, sprite.stoneDeep],
  [2, 10, 1, 5, sprite.stoneDeep],
  [1, 16, 1, 5, sprite.stoneDeep],
  [2, 22, 1, 5, sprite.stoneDeep],
  [21, 10, 1, 5, sprite.stoneDeep],
  [22, 16, 1, 5, sprite.stoneDeep],
  [21, 22, 1, 5, sprite.stoneDeep],
]

// Искры s1..s6: позиция и сдвиг фазы. Средний риск выпускает две, высокий — четыре, критический — все.
const sparks: readonly (readonly [x: number, y: number, delay: string])[] = [
  [7, 22, '-.2s'],
  [16, 20, '-.7s'],
  [12, 24, '-.4s'],
  [9, 18, '-1s'],
  [14, 16, '-.55s'],
  [6, 15, '-.1s'],
]
const sparkCount: Record<PortalLook, number> = {
  empty: 0,
  low: 0,
  medium: 2,
  high: 4,
  critical: 6,
  archived: 0,
}

// Три тлеющие руны пустой арки, мерцают вразнобой.
const emberRunes: readonly (readonly [d: string, delay: string | undefined])[] = [
  ['M11,10h1v5h-1z M12,11h1v1h-1z M13,12h1v1h-1z', undefined],
  ['M8,18h3v1h-3z M9,18h1v4h-1z', '-1s'],
  ['M14,18h1v4h-1z M15,19h1v1h-1z M15,21h1v1h-1z', '-2s'],
]

function isRiskLook(look: PortalLook): look is RiskLevel {
  return look !== 'empty' && look !== 'archived'
}

// Имена как в канвасе 19-c-portal, кроме архива: там «Портал закрыт», но архивный портал мог и
// схлопнуться, поэтому «погас» — как на плашке «ЗАКРЫТ / СХЛОПНУЛСЯ»
function portalName(look: PortalLook, observers: number): string {
  if (look === 'empty') return 'Пустая арка'
  if (look === 'archived') return 'Портал погас'
  const name = `Портал, риск ${risk[look].label.toLowerCase()}`
  return observers > 0 ? `${name}, наблюдателей: ${observers}` : name
}

/** Фигурка наблюдателя 5×8 с тёмным контуром, чтобы читаться на ярком ядре портала. */
function Observer({
  width,
  height,
  margin,
  delay,
}: Record<'width' | 'height' | 'margin', number> & { delay: string }) {
  return (
    <svg
      className="px-portal__observer"
      data-testid="observer"
      viewBox="-1 -1 7 10"
      width={width}
      height={height}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ margin: `0 ${margin}px`, animationDelay: delay }}
    >
      <g
        fill={sprite.observerOutline}
        stroke={sprite.observerOutline}
        strokeWidth={1.6}
        strokeLinejoin="miter"
      >
        <path d="M1,0h3v1h-3z M0,2h5v3h-5z M1,5h3v1h-3z" />
        <path d="M1,6h1v2h-1z M3,6h1v2h-1z" />
      </g>
      <path
        d="M1,0h3v1h-3z M1,1h1v1h-1z M3,1h1v1h-1z M0,2h5v3h-5z M1,5h3v1h-3z"
        fill={sprite.observerCloak}
      />
      <path d="M2,1h1v1h-1z" fill={sprite.observerFace} />
      <path d="M0,4h5v1h-5z" fill={sprite.observerBelt} />
      <path d="M1,6h1v2h-1z M3,6h1v2h-1z" fill={sprite.observerLegs} />
    </svg>
  )
}

/** Арка зала с порталом: свечение и анимация по уровню риска, наблюдатели у порога. */
export function Portal({
  look,
  observers = 0,
  width = 120,
}: {
  look: PortalLook
  observers?: number
  width?: number
}) {
  const height = Math.round((width * 28) / 24)
  const shown = isRiskLook(look)
    ? Math.min(CONFIG.maxObserversPerPortal, 3, Math.max(0, Math.floor(observers)))
    : 0
  const [c0, c1, c2, c3] = portalShades[look]
  // Клетка фигурки наблюдателя в пикселях экрана — от ширины арки.
  const cell = Math.max(4, Math.round(width / 17))

  return (
    <div
      className={`px-portal px-portal--${look}`}
      data-look={look}
      role="img"
      aria-label={portalName(look, shown)}
      style={{ width, height }}
    >
      <svg
        viewBox="0 0 24 28"
        width={width}
        height={height}
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <g className="px-portal__shake">
          <path d={ARCH_OUTLINE} fill={sprite.archStone} />
          {stoneDetails.map(([x, y, w, h, fill], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
          ))}
          <path d={ARCH_OPENING} fill={c0} />
          {look === 'empty' ? (
            <g>
              {emberRunes.map(([d, delay]) => (
                <path
                  key={d}
                  className="px-portal__rune"
                  d={d}
                  fill={sprite.emberRune}
                  style={delay ? { animationDelay: delay } : undefined}
                />
              ))}
            </g>
          ) : (
            <g>
              <path className="px-portal__l2" d={LAYER_2} fill={c1} />
              <path className="px-portal__l3" d={LAYER_3} fill={c2} />
              <path className="px-portal__core" d={CORE} fill={c3} />
              <rect x={5} y={12} width={1} height={1} fill={c3} />
              <rect x={18} y={17} width={1} height={1} fill={c3} />
              <rect x={7} y={21} width={1} height={1} fill={c2} />
              <rect x={16} y={11} width={1} height={1} fill={c2} />
              {sparks.slice(0, sparkCount[look]).map(([x, y, delay]) => (
                <rect
                  key={`${x},${y}`}
                  className="px-portal__spark"
                  x={x}
                  y={y}
                  width={1}
                  height={1}
                  fill={c3}
                  style={{ animationDelay: delay }}
                />
              ))}
            </g>
          )}
          <rect x={0} y={27} width={24} height={1} fill={sprite.sill} />
        </g>
      </svg>
      {shown > 0 && (
        <div className="px-portal__observers" style={{ bottom: -Math.round(cell * 1.6) }}>
          {Array.from({ length: shown }, (_, i) => (
            <Observer
              key={i}
              width={cell * 7}
              height={cell * 10}
              margin={-Math.round(cell * 0.7)}
              delay={`-${i * 0.5}s`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
