import { CONFIG } from '../../domain'
import { colors, portalShades, risk, type PortalLook, type RiskLevel } from '../theme/tokens'
import { cellsFromArt, cellsToPath, type Cell } from './pixels'
import { Rune } from './Rune'
import './sprites.css'

// Сетка арки 32×40: полукруглый свод с центром (16, 16), проём шириной 22,
// столбы до строки 36, ниже — порог из трёх строк.
const W = 32
const H = 40
const ARCH_CY = 16
const FLOOR_Y = 37
const OUTER = 15
const INNER = 11
const FRAMES = 4

function inArch(x: number, y: number, radius: number): boolean {
  const px = x + 0.5 - W / 2
  const py = y + 0.5
  if (py >= ARCH_CY) return Math.abs(px) < radius
  return Math.hypot(px, py - ARCH_CY) < radius
}

function frac(n: number): number {
  return n - Math.floor(n)
}

const stone: Cell[] = []
const mortar: Cell[] = []
const glow: Cell[] = []
const opening: Cell[] = []
for (let y = 0; y < FLOOR_Y; y++) {
  for (let x = 0; x < W; x++) {
    if (inArch(x, y, INNER)) {
      opening.push([x, y])
      continue
    }
    if (!inArch(x, y, OUTER)) continue
    if (inArch(x, y, INNER + 1)) glow.push([x, y])
    // швы кладки: на столбах — ряды по 5 строк со смещённой вертикалью, на своде — клинья
    const isSeam =
      y >= ARCH_CY
        ? y % 5 === 0 || x === (x < W / 2 ? 2 : 29) + (Math.floor(y / 5) % 2)
        : frac(Math.atan2(ARCH_CY - y - 0.5, x + 0.5 - W / 2) / (Math.PI / 9)) < 0.14
    ;(isSeam ? mortar : stone).push([x, y])
  }
}
const floor: Cell[] = []
for (let y = FLOOR_Y; y < H; y++) for (let x = 0; x < W; x++) floor.push([x, y])
const floorSeams: Cell[] = floor.filter(([x, y]) => y === FLOOR_Y || (x + (y % 2) * 4) % 8 === 0)
for (let x = W / 2 - INNER; x < W / 2 + INNER; x++) glow.push([x, FLOOR_Y])

// Кадры вихря: рукава спирали поверх концентрических колец; каждый кадр сдвигает рукава
// на четверть периода — анимация steps() перелистывает кадры. Чем выше риск, тем больше
// рукавов, туже закрутка и рванее края: виды различаются формой, а не только цветом.
type Swirl = { arms: number; twist: number; jitter: number }
const swirls: Record<PortalLook, Swirl> = {
  empty: { arms: 0, twist: 1, jitter: 0 },
  low: { arms: 1, twist: 8, jitter: 0 },
  medium: { arms: 2, twist: 6, jitter: 0.12 },
  high: { arms: 3, twist: 5, jitter: 0.1 },
  critical: { arms: 4, twist: 3.5, jitter: 0.22 },
  archived: { arms: 2, twist: 6, jitter: 0 },
}

function swirlFrames({ arms, twist, jitter }: Swirl): string[][] {
  return Array.from({ length: FRAMES }, (_, f) => {
    const byShade: Cell[][] = [[], [], [], []]
    for (const [x, y] of opening) {
      const dx = x + 0.5 - W / 2
      const dy = (y + 0.5 - 22) * 0.75
      const r = Math.hypot(dx, dy)
      let shade = r < 2.2 ? 3 : r < 5 ? 2 : r < 9 ? 1 : 0
      const noise = (((x * 7 + y * 13 + f * 5) % 9) / 9 - 0.5) * jitter
      const arm = frac((Math.atan2(dy, dx) / (2 * Math.PI)) * arms + r / twist - f / FRAMES + noise)
      if (arms > 0 && arm < 0.28 && shade < 3) shade++
      byShade[shade]!.push([x, y])
    }
    return byShade.map(cellsToPath)
  })
}

const frames = Object.fromEntries(
  Object.entries(swirls).map(([look, swirl]) => [look, swirlFrames(swirl)]),
) as Record<PortalLook, string[][]>

// Пустая арка: три вырезанные руны — на замковом камне и на столбах.
const carvedRunes = cellsToPath([
  ...cellsFromArt(['#.#', '.#.', '#.#'], 15, 2),
  ...cellsFromArt(['.#.', '###', '.#.'], 2, 22),
  ...cellsFromArt(['##.', '#.#', '.##'], 27, 22),
])

// Искры-крестики над кладкой (высокий и критический риск): яркое ядро и лучи цвета риска.
const sparks: Cell[] = [
  [9, 3],
  [28, 9],
  [2, 12],
  [23, 2],
  [2, 21],
  [29, 28],
]
const sparkRays = cellsToPath([
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
])

// Трещины по камню (критический риск).
const cracks = cellsToPath([
  [4, 12],
  [3, 12],
  [3, 11],
  [2, 10],
  [2, 9],
  [27, 20],
  [28, 21],
  [28, 22],
  [29, 23],
  [30, 24],
  [17, 4],
  [18, 3],
  [18, 2],
  [19, 1],
])

// Наблюдатель 5×8 в капюшоне, с тёмным контуром, чтобы читаться на ярком ядре портала.
const observerArt = ['.###.', '##.##', '.###.', '#####', '#####', '.###.', '.#.#.', '.#.#.']
const observerBody = cellsFromArt(observerArt)
const observerPath = cellsToPath(observerBody)
const observerOutline = cellsToPath(
  (() => {
    const body = new Set(observerBody.map(([x, y]) => `${x},${y}`))
    const ring: Cell[] = []
    for (let y = -1; y <= observerArt.length; y++) {
      for (let x = -1; x <= 5; x++) {
        if (body.has(`${x},${y}`)) continue
        const touches = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ].some(([nx, ny]) => body.has(`${nx},${ny}`))
        if (touches && y < observerArt.length) ring.push([x, y])
      }
    }
    return ring
  })(),
)
const observerX = [8, 14, 20]
const OBSERVER_Y = FLOOR_Y - observerArt.length

const paths = {
  stone: cellsToPath(stone),
  mortar: cellsToPath(mortar),
  glow: cellsToPath(glow),
  floor: cellsToPath(floor),
  floorSeams: cellsToPath(floorSeams),
}

function isRiskLook(look: PortalLook): look is RiskLevel {
  return look !== 'empty' && look !== 'archived'
}

function portalName(look: PortalLook, observers: number): string {
  if (look === 'empty') return 'Пустая арка'
  if (look === 'archived') return 'Портал погас'
  const name = `Портал, риск ${risk[look].label}`
  return observers > 0 ? `${name}, наблюдателей: ${observers}` : name
}

/** Арка зала с порталом: свечение и анимация по уровню риска, наблюдатели у порога. */
export function Portal({ look, observers = 0 }: { look: PortalLook; observers?: number }) {
  const level = isRiskLook(look) ? look : null
  const shown = level
    ? Math.min(CONFIG.maxObserversPerPortal, Math.max(0, Math.floor(observers)))
    : 0
  const shades = portalShades[look]

  return (
    <div className="px-portal" data-look={look} role="img" aria-label={portalName(look, shown)}>
      <svg
        className="px-portal__art"
        viewBox={`0 0 ${W} ${H}`}
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <path d={paths.floor} fill={colors.edgeSoft} />
        <path d={paths.floorSeams} fill={colors.stoneSeam} />
        <path d={paths.stone} fill={colors.edge} />
        <path d={paths.mortar} fill={colors.stoneSeam} />
        <g className="px-portal__swirl">
          {(level ? frames[look] : frames[look].slice(0, 1)).map((frame, i) => (
            <g key={i} className="px-portal__frame">
              {frame.map((d, s) => (
                <path key={s} d={d} fill={shades[s]} />
              ))}
            </g>
          ))}
        </g>
        {level && <path className="px-portal__glow" d={paths.glow} fill={risk[level].c} />}
        {look === 'empty' && <path d={carvedRunes} fill={colors.textDim} />}
        {level === 'critical' && (
          <path className="px-portal__crack" d={cracks} fill={risk.critical.c} />
        )}
        {(level === 'high' || level === 'critical') && (
          <g>
            {sparks.map(([x, y], i) => (
              <g key={i} className="px-portal__spark" transform={`translate(${x} ${y})`}>
                <path d={sparkRays} fill={risk[level].c} />
                <rect width={1} height={1} fill={shades[3]} />
              </g>
            ))}
          </g>
        )}
        {observerX.slice(0, shown).map((x) => (
          <g key={x} data-testid="observer" transform={`translate(${x} ${OBSERVER_Y})`}>
            <path d={observerOutline} fill={colors.night} />
            <path d={observerPath} fill={colors.observerOnSite} />
          </g>
        ))}
      </svg>
      {level && (
        <div className="px-portal__plate">
          <Rune level={level} />
          <span>{risk[level].label}</span>
        </div>
      )}
    </div>
  )
}
