import { useState, type CSSProperties } from 'react'
import { useLabSelector } from '../../app/hooks'
import type { World } from '../../domain'
import { Creatures } from '../sprites'
import { RouteLink } from './RouteLink'
import { ScreenFrame } from './ScreenFrame'
import { WorldProgress } from './WorldProgress'
import { worldStats, type WorldStats } from './worldStats'
import './screens.css'

// Иконка атласа 9×9 из канваса; у пустого атласа она приглушена
const ATLAS_ICON =
  'M2,0h5v1h-5z M1,1h1v1h-1z M4,1h1v1h-1z M7,1h1v1h-1z M0,2h1v2h-1z M4,2h1v2h-1z M8,2h1v2h-1z M0,4h9v1h-9z M0,5h1v2h-1z M4,5h1v2h-1z M8,5h1v2h-1z M1,7h1v1h-1z M4,7h1v1h-1z M7,7h1v1h-1z M2,8h5v1h-5z'
const FULL_ICON =
  'M3,0h2v1h-2z M3,1h2v2h-2z M0,3h8v1h-8z M1,4h6v1h-6z M2,5h4v1h-4z M1,6h2v2h-2z M5,6h2v2h-2z'

type SortKey = 'study' | 'visits' | 'last'

const TABS: readonly (readonly [SortKey, string])[] = [
  ['study', 'по изученности'],
  ['visits', 'по посещениям'],
  ['last', 'по последнему посещению'],
]

interface Entry {
  world: World
  stats: WorldStats
}

// Доля изученных существ; у мира без существ — 0, а не NaN
function ratio(world: World): number {
  return world.creatures > 0 ? world.studied / world.creatures : 0
}

// Порядки сортировки атласа (spec §9): изученность, посещения, последнее посещение
const comparators: Record<SortKey, (a: World, b: World) => number> = {
  study: (a, b) => ratio(b) - ratio(a) || b.creatures - a.creatures,
  visits: (a, b) => b.visits - a.visits || b.lastVisit - a.lastVisit,
  last: (a, b) => b.lastVisit - a.lastVisit,
}

// Высота вкладки (40 px) — в классе atlas-tab: на узком экране она не ниже 44 px
const tabStyle = (on: boolean): CSSProperties => ({
  padding: '0 14px',
  boxSizing: 'border-box',
  fontFamily: 'var(--f-ui)',
  fontSize: 15,
  fontWeight: 600,
  color: on ? 'var(--c-on-torch)' : 'var(--c-parchment)',
  background: on ? 'var(--c-gold-plate)' : 'var(--c-tab)',
  border: `3px solid ${on ? 'var(--c-tab-on-edge)' : 'var(--c-parchment-edge)'}`,
  boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.3)',
  cursor: 'pointer',
})

const statValue: CSSProperties = { fontWeight: 600, color: 'var(--c-ink-title)' }

function WorldCard({ world, stats }: Entry) {
  const titleId = `atlas-world-${world.code}`
  return (
    <article
      aria-labelledby={titleId}
      className="px-notch"
      style={{
        background: stats.full ? 'var(--s-studied-gold)' : 'var(--c-parchment-edge)',
        padding: 6,
      }}
    >
      <div
        className="px-notch"
        style={{
          height: '100%',
          boxSizing: 'border-box',
          background: 'var(--c-parchment)',
          color: 'var(--c-ink-title)',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxShadow: 'inset 0 -5px 0 var(--c-parchment-shade)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: 'var(--f-pixel)',
              fontSize: 11,
              color: 'var(--c-ink-label)',
              background: 'var(--c-parchment-plate)',
              padding: '4px 8px',
            }}
          >
            {world.code}
          </span>
          {stats.full && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 1,
                color: 'var(--c-on-gold-plate)',
                background: 'var(--c-gold-plate)',
                border: '3px double var(--c-gold-edge)',
                padding: '2px 10px',
              }}
            >
              <svg
                viewBox="0 0 8 8"
                width={14}
                height={14}
                shapeRendering="crispEdges"
                aria-hidden="true"
              >
                <path d={FULL_ICON} fill="var(--c-on-gold-plate)" />
              </svg>
              ИЗУЧЕН ПОЛНОСТЬЮ
            </span>
          )}
        </div>
        <h2
          id={titleId}
          style={{
            margin: 0,
            fontFamily: 'var(--f-ui)',
            fontWeight: 600,
            fontSize: 26,
            lineHeight: '28px',
            color: 'var(--c-ink-title)',
          }}
        >
          {world.name}
        </h2>
        <Creatures
          total={world.creatures}
          studied={world.studied}
          progress={stats.nextPct}
          size={32}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <WorldProgress stats={stats} height={12} />
          <span style={{ fontWeight: 600, fontSize: 17, color: 'var(--c-ink-title)' }}>
            {stats.donePct} %
          </span>
        </div>
        <div
          className="atlas-stats"
          style={{
            display: 'grid',
            gap: '6px 14px',
            fontSize: 17,
            lineHeight: '20px',
            color: 'var(--c-ink-body)',
          }}
        >
          <span>
            Изучено:{' '}
            <b style={statValue}>
              {world.studied} / {world.creatures}
            </b>
          </span>
          <span>
            Посещений: <b style={statValue}>{world.visits}</b>
          </span>
          <span>
            Открыто сейчас: <b style={statValue}>{stats.open}</b>
          </span>
          <span>
            Последнее: <b style={statValue}>мин {world.lastVisit}</b>
          </span>
        </div>
        <RouteLink
          to={{ screen: 'world', world: world.name }}
          style={{
            marginTop: 'auto',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--c-ink-link)',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Страница мира →
        </RouteLink>
      </div>
    </article>
  )
}

function EmptyAtlas() {
  return (
    <div style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="px-notch"
        style={{
          width: 620,
          maxWidth: '100%',
          boxSizing: 'border-box',
          background: 'var(--c-parchment)',
          color: 'var(--c-ink-title)',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          boxShadow: 'inset 0 -5px 0 var(--c-parchment-shade)',
        }}
      >
        <svg
          viewBox="0 0 9 9"
          width={90}
          height={90}
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          <path d={ATLAS_ICON} fill="var(--c-parchment-icon)" />
        </svg>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--f-ui)',
            fontWeight: 600,
            fontSize: 30,
            lineHeight: '36px',
            textAlign: 'center',
          }}
        >
          Ни один мир ещё не открыт
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--f-prose)',
            fontSize: 19,
            lineHeight: '25px',
            textAlign: 'center',
            color: 'var(--c-ink-soft)',
            textWrap: 'pretty',
          }}
        >
          Страницы появятся здесь, как только смотритель откроет первый портал в зале лаборатории.
        </p>
        <RouteLink
          to={{ screen: 'hall' }}
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--c-on-torch)',
            background: 'var(--c-torch)',
            border: '3px solid var(--c-torch-light)',
            boxShadow: 'inset 0 -4px 0 var(--c-torch-deep)',
            padding: '10px 18px',
            textDecoration: 'none',
          }}
        >
          В зал лаборатории
        </RouteLink>
      </div>
    </div>
  )
}

/** Атлас миров: карточки известных миров с сортировкой (docs/spec.md §9, кадры 10–11). */
export function AtlasScreen() {
  const lab = useLabSelector((state) => state.lab)
  const [sort, setSort] = useState<SortKey>('study')
  const entries: Entry[] = Object.values(lab.worlds)
    .sort(comparators[sort])
    .map((world) => ({ world, stats: worldStats(lab, world) }))
  const hasWorlds = entries.length > 0

  return (
    <ScreenFrame>
      <div
        className="atlas-head"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg
            viewBox="0 0 9 9"
            width={36}
            height={36}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <path d={ATLAS_ICON} fill="var(--c-cellar-icon)" />
          </svg>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--f-pixel)',
              fontWeight: 400,
              fontSize: 22,
              color: 'var(--c-cellar-title)',
              letterSpacing: 1,
            }}
          >
            АТЛАС МИРОВ
          </h1>
        </div>
        {hasWorlds && (
          <div className="atlas-sort" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className="atlas-sort-label"
              style={{ fontSize: 14, color: 'var(--c-cellar-label)', marginRight: 6 }}
            >
              Сортировка
            </span>
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
                className="atlas-tab"
                style={tabStyle(sort === key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {hasWorlds ? (
        <div
          // Как кадр 11: сетка занимает экран до дока, ряды делят высоту поровну; больше двух
          // рядов — не уже 300 px, экран прокручивается. Столбцы и ряды — в классе atlas-grid
          className="atlas-grid"
          style={{
            flex: '1 1 auto',
            display: 'grid',
            gap: 22,
          }}
        >
          {entries.map((entry) => (
            <WorldCard key={entry.world.name} {...entry} />
          ))}
        </div>
      ) : (
        <EmptyAtlas />
      )}
    </ScreenFrame>
  )
}
