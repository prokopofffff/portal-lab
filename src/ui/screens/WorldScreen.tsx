import type { CSSProperties } from 'react'
import { useLabSelector } from '../../app/hooks'
import {
  assessRisk,
  creatureName,
  filterLog,
  type Lab,
  type LogEntry,
  type Portal,
  type World,
} from '../../domain'
import { creatureColors, risk, sprite } from '../theme/tokens'
import { Creatures, Portal as PortalSprite, RiskTag, Rune } from '../sprites'
import { CREATURE_BODIES, UNKNOWN_CREATURE } from '../sprites/creatureGlyphs'
import { RouteLink } from './RouteLink'
import { ScreenFrame } from './ScreenFrame'
import { WorldProgress } from './WorldProgress'
import { worldPortals, worldStats, type WorldStats } from './worldStats'
import './screens.css'

// Стрелка «изучение общее» 8×8 из канваса
const SHARED_ICON = 'M3,0h2v1h-2z M3,1h2v2h-2z M0,3h8v1h-8z M1,4h6v1h-6z M2,5h4v1h-4z'

const pageLabel: CSSProperties = { fontSize: 14, letterSpacing: 1, color: 'var(--c-ink-label)' }

const page: CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  boxSizing: 'border-box',
  background: 'var(--c-parchment)',
  color: 'var(--c-ink-title)',
  padding: '22px 26px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const statNumber: CSSProperties = { fontFamily: 'var(--f-ui)', fontSize: 22, fontWeight: 600 }

function BackLink() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <RouteLink
        to={{ screen: 'atlas' }}
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--c-cellar-title)',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
        }}
      >
        ← Атлас миров
      </RouteLink>
      <span style={{ fontSize: 14, color: 'var(--c-cellar-label)' }}>страница мира</span>
    </div>
  )
}

// Статус портала в строке: открытый — с учёбой, если на месте есть наблюдатели; архивный — без времени
function statusText(portal: Portal): string {
  if (portal.status === 'closed') return 'Закрыт'
  if (portal.status === 'collapsed') return 'Схлопнулся'
  const open = portal.observers > 0 ? 'Открыт, идёт изучение' : 'Открыт'
  return `${open} · схлопнется через ${portal.timeLeft} мин`
}

function PortalRow({ portal }: { portal: Portal }) {
  const assessment = portal.status === 'open' ? assessRisk(portal) : null
  const level = assessment?.level
  return (
    <RouteLink
      to={{ screen: 'portal', portal: portal.name }}
      className="px-notch"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        textDecoration: 'none',
        color: 'var(--c-text)',
        background: `var(--risk-${level ?? 'archived'}-c)`,
        padding: 5,
      }}
    >
      <span
        className="px-notch"
        style={{
          flex: '1 1 0',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'var(--s-sill)',
          padding: '10px 16px 10px 12px',
          boxShadow: 'inset 0 0 0 2px var(--c-edge-soft)',
        }}
      >
        <span
          style={{
            flex: 'none',
            width: 96,
            height: 104,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--c-row-stage)',
            overflow: 'hidden',
          }}
        >
          <PortalSprite look={level ?? 'archived'} observers={portal.observers} width={62} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--f-pixel)', fontSize: 14, color: 'var(--c-row-title)' }}>
            {portal.name}
          </span>
          <span style={{ fontSize: 15, color: 'var(--c-row-text)' }}>{statusText(portal)}</span>
          {assessment && level ? (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                alignSelf: 'flex-start',
                background: `var(--risk-${level}-plate)`,
                color: `var(--risk-${level}-on)`,
                padding: '3px 12px 3px 8px',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              <Rune level={level} size={14} />
              {risk[level].label.toUpperCase()} · {assessment.score}
            </span>
          ) : (
            <span style={{ alignSelf: 'flex-start' }}>
              <RiskTag look="archived" />
            </span>
          )}
        </span>
      </span>
    </RouteLink>
  )
}

function HistoryItem({ entry }: { entry: LogEntry }) {
  const system = entry.kind === 'system'
  const ink = system
    ? 'var(--c-ink-system)'
    : entry.kind === 'rejection'
      ? 'var(--c-ink-rejection)'
      : 'var(--c-ink-title)'
  return (
    <li style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
      <span
        style={{
          flex: 'none',
          width: 76,
          fontFamily: 'var(--f-ui)',
          fontWeight: 600,
          fontSize: 15,
          color: 'var(--c-ink-time)',
        }}
      >
        мин {entry.time}
      </span>
      <span
        style={{
          fontFamily: 'var(--f-prose)',
          fontSize: 17,
          lineHeight: '21px',
          color: ink,
          fontStyle: system ? 'italic' : 'normal',
        }}
      >
        {entry.text}
      </span>
    </li>
  )
}

function LeftPage({ world, stats }: { world: World; stats: WorldStats }) {
  return (
    <section style={{ ...page, boxShadow: 'inset -10px 0 18px -8px rgba(60,40,10,.45)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--f-pixel)',
              fontSize: 11,
              color: 'var(--c-ink-label)',
              background: 'var(--c-parchment-plate)',
              padding: '4px 8px',
              alignSelf: 'flex-start',
            }}
          >
            {world.code}
          </span>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--f-ui)',
              fontWeight: 600,
              fontSize: 36,
              lineHeight: '38px',
              color: 'var(--c-ink-title)',
            }}
          >
            {world.name}
          </h1>
        </div>
        <div
          role="group"
          aria-label="Сводка мира"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, auto)',
            gap: '4px 22px',
            fontSize: 16,
            color: 'var(--c-ink-body)',
            textAlign: 'right',
          }}
        >
          <span>Посещений</span>
          <span>Открыто сейчас</span>
          <span>Последнее</span>
          <b style={statNumber}>{world.visits}</b>
          <b style={statNumber}>{stats.open}</b>
          <b style={statNumber}>мин {world.lastVisit}</b>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={pageLabel}>
          СУЩЕСТВА · ИЗУЧЕНО {world.studied} ИЗ {world.creatures}
        </span>
        <span
          style={{
            fontFamily: 'var(--f-prose)',
            fontSize: 16,
            fontStyle: 'italic',
            color: 'var(--c-ink-soft)',
          }}
        >
          неизученные проявятся, когда наблюдатели доберутся до них
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 'none', fontSize: 17, fontWeight: 600 }}>
          Прогресс мира: {stats.donePct} %
        </span>
        <WorldProgress stats={stats} height={14} />
        {!stats.full && world.creatures > 0 && (
          <span style={{ flex: 'none', fontSize: 17, fontWeight: 600 }}>
            существо №{world.studied + 1}: {stats.nextPct} %
          </span>
        )}
      </div>
      <CreatureGrid world={world} nextPct={stats.full ? 0 : stats.nextPct} />
    </section>
  )
}

// Клетка существа на странице мира (кадр 12): изученное — по имени, изучаемое проступает снизу
const tileLook = {
  known: { bg: sprite.cellBg, edge: sprite.cellEdge, glow: 'none', text: 'var(--c-text)' },
  study: {
    bg: sprite.studyBg,
    edge: sprite.study,
    glow: `0 0 10px color-mix(in srgb, ${sprite.study} 46.7%, transparent)`,
    text: sprite.studyBadge,
  },
  unknown: {
    bg: sprite.unknownBg,
    edge: sprite.unknownEdge,
    glow: 'none',
    text: sprite.unknownLabel,
  },
} as const

function CreatureGlyph({ d, fill, clip }: { d: string; fill: string; clip?: number }) {
  return (
    <svg
      viewBox="0 0 8 8"
      width={64}
      height={64}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={
        clip === undefined
          ? undefined
          : { position: 'absolute', left: 0, top: 0, clipPath: `inset(${clip}% 0 0 0)` }
      }
    >
      <path d={d} fill={fill} />
    </svg>
  )
}

/** Существа мира плитками 3 в ряд: имя изученного, «Изучается · N %» и «???» для неизвестных. */
function CreatureGrid({ world, nextPct }: { world: World; nextPct: number }) {
  if (world.creatures === 0) return <Creatures total={0} studied={0} />
  const tiles = Array.from({ length: world.creatures }, (_, i) => {
    const body = CREATURE_BODIES[i % CREATURE_BODIES.length]!
    const color = creatureColors[i % creatureColors.length]!
    if (i < world.studied) return { kind: 'known', body, color, name: creatureName(world.name, i) }
    if (i === world.studied && nextPct > 0) {
      return { kind: 'study', body, color, name: `Изучается · ${nextPct} %` }
    }
    return { kind: 'unknown', body: UNKNOWN_CREATURE, color: sprite.unknownGlyph, name: '???' }
  })
  return (
    <ul
      aria-label="Существа мира"
      style={{
        flex: '1 1 0',
        margin: 0,
        padding: 0,
        listStyle: 'none',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        // Девять плиток делят страницу поровну, как в канвасе; больше — страница растёт
        gridAutoRows: 'minmax(108px, 1fr)',
        gap: 12,
      }}
    >
      {tiles.map((t, i) => {
        const look = tileLook[t.kind as keyof typeof tileLook]
        return (
          <li
            key={i}
            data-creature={t.kind}
            style={{
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: look.bg,
              border: `3px solid ${look.edge}`,
              boxShadow: look.glow,
            }}
          >
            <div style={{ position: 'relative', width: 64, height: 64 }}>
              {t.kind === 'study' ? (
                <>
                  <CreatureGlyph d={t.body} fill={sprite.studyGhost} />
                  <CreatureGlyph d={t.body} fill={t.color} clip={100 - nextPct} />
                </>
              ) : (
                <CreatureGlyph d={t.body} fill={t.color} />
              )}
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: look.text }}>{t.name}</span>
          </li>
        )
      })}
    </ul>
  )
}

function RightPage({ lab, world, stats }: { lab: Lab; world: World; stats: WorldStats }) {
  // Открытые впереди, архив закрытых и схлопнувшихся следом; порядок открытия внутри групп
  const portals = worldPortals(lab, world.name)
  const ordered = [
    ...portals.filter((p) => p.status === 'open'),
    ...portals.filter((p) => p.status !== 'open'),
  ]
  const history = filterLog(lab.log, { world: world.name })
  return (
    <section style={{ ...page, boxShadow: 'inset 10px 0 18px -8px rgba(60,40,10,.45)' }}>
      <h2 style={{ ...pageLabel, margin: 0, fontWeight: 400 }}>ПОРТАЛЫ В ЭТОТ МИР</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ordered.map((portal) => (
          <PortalRow key={portal.name} portal={portal} />
        ))}
      </div>
      {stats.open > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            background: 'var(--c-parchment-plate)',
            fontSize: 15,
            color: 'var(--c-ink-body)',
          }}
        >
          <svg
            viewBox="0 0 8 8"
            width={16}
            height={16}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <path d={SHARED_ICON} fill="var(--c-ink-label)" />
          </svg>
          Изучение общее для {stats.open === 2 ? 'обоих' : 'всех'} открытых порталов:{' '}
          {world.studied} из {world.creatures}
        </div>
      )}
      <h2 style={{ ...pageLabel, margin: '4px 0 0', fontWeight: 400 }}>ИСТОРИЯ МИРА</h2>
      <ul
        aria-label="История мира"
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        {history.map((entry, i) => (
          <HistoryItem key={i} entry={entry} />
        ))}
      </ul>
    </section>
  )
}

/** Страница мира: существа, все порталы в мир (и архив) и история мира (docs/spec.md §9, кадр 12). */
export function WorldScreen({ world: worldName }: { world: string }) {
  const lab = useLabSelector((state) => state.lab)
  const world = lab.worlds[worldName]

  return (
    <ScreenFrame gap={14} padding="20px 48px 24px">
      <BackLink />
      {world ? (
        <div
          style={{ flex: '1 1 0', display: 'flex', boxShadow: '0 0 0 4px var(--c-parchment-edge)' }}
        >
          <LeftPage world={world} stats={worldStats(lab, world)} />
          <div style={{ flex: 'none', width: 8, background: 'var(--c-parchment-spine)' }} />
          <RightPage lab={lab} world={world} stats={worldStats(lab, world)} />
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--f-prose)',
            fontSize: 19,
            color: 'var(--c-cellar-label)',
          }}
        >
          Такого мира нет в атласе
        </p>
      )}
    </ScreenFrame>
  )
}
