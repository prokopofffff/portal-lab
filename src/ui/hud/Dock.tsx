import { useRoute, type Route } from '../../app/navigation'
import { RouteLink } from '../screens/RouteLink'

type Tab = 'hall' | 'atlas' | 'book'

// Вкладки дока и иконки 9×9 из канваса 18-c-dock
const TABS: readonly { tab: Tab; label: string; to: Route; d: string }[] = [
  {
    tab: 'hall',
    label: 'Зал лаборатории',
    to: { screen: 'hall' },
    d: 'M2,0h5v1h-5z M1,1h7v1h-7z M0,2h2v1h-2z M7,2h2v1h-2z M0,3h1v5h-1z M8,3h1v5h-1z M0,8h9v1h-9z',
  },
  {
    tab: 'atlas',
    label: 'Атлас миров',
    to: { screen: 'atlas' },
    d: 'M2,0h5v1h-5z M1,1h1v1h-1z M4,1h1v1h-1z M7,1h1v1h-1z M0,2h1v2h-1z M4,2h1v2h-1z M8,2h1v2h-1z M0,4h9v1h-9z M0,5h1v2h-1z M4,5h1v2h-1z M8,5h1v2h-1z M1,7h1v1h-1z M4,7h1v1h-1z M7,7h1v1h-1z M2,8h5v1h-5z',
  },
  {
    tab: 'book',
    label: 'Книга журнала',
    to: { screen: 'journal' },
    d: 'M0,1h9v1h-9z M0,7h9v1h-9z M0,2h1v5h-1z M8,2h1v5h-1z M4,2h1v5h-1z M2,3h1v1h-1z M2,5h1v1h-1z M6,3h1v1h-1z M6,5h1v1h-1z',
  },
]

// Карточка портала открывается из зала, страница мира — из атласа
const TAB_OF: Record<Route['screen'], Tab> = {
  hall: 'hall',
  portal: 'hall',
  atlas: 'atlas',
  world: 'atlas',
  journal: 'book',
}

/** Нижняя панель входа (канвас 18-c-dock): разделы и печать лаборатории. */
export function Dock({ onSeal }: { onSeal: () => void }) {
  const active = TAB_OF[useRoute().screen]
  return (
    <div
      style={{
        flex: 'none',
        width: '100%',
        boxSizing: 'border-box',
        height: 84,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        background: 'var(--c-panel)',
        borderTop: '4px solid var(--c-edge)',
        boxShadow: 'inset 0 4px 0 var(--c-well)',
        fontFamily: 'var(--f-ui)',
        position: 'relative',
      }}
    >
      <nav aria-label="Разделы" style={{ display: 'flex', gap: 12 }}>
        {TABS.map(({ tab, label, to, d }) => {
          const on = tab === active
          return (
            <RouteLink
              key={tab}
              to={to}
              current={on}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: 250,
                height: 56,
                boxSizing: 'border-box',
                padding: '0 16px',
                textDecoration: 'none',
                color: on ? 'var(--c-on-torch)' : 'var(--c-text-soft)',
                background: on ? 'var(--c-torch)' : 'var(--c-control)',
                border: `3px solid ${on ? 'var(--c-torch-light)' : 'var(--c-edge-strong)'}`,
                boxShadow: 'inset 0 -4px 0 rgba(0,0,0,.35)',
              }}
            >
              <svg
                viewBox="0 0 9 9"
                width={27}
                height={27}
                shapeRendering="crispEdges"
                aria-hidden="true"
              >
                <path d={d} fill={on ? 'var(--c-on-torch)' : 'var(--c-torch)'} />
              </svg>
              <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
            </RouteLink>
          )
        })}
      </nav>
      <div style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)' }}>
        <button
          type="button"
          onClick={onSeal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 36,
            padding: '0 12px',
            boxSizing: 'border-box',
            fontFamily: 'var(--f-ui)',
            fontSize: 13,
            color: 'var(--c-seal)',
            background: 'transparent',
            border: '2px dashed var(--c-seal-edge)',
            cursor: 'pointer',
          }}
        >
          <svg
            viewBox="0 0 7 7"
            width={14}
            height={14}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <path
              d="M2,0h3v1h-3z M1,1h1v2h-1z M5,1h1v2h-1z M0,3h7v4h-7z"
              fill="var(--c-seal-lock)"
            />
            <path d="M3,4h1v2h-1z" fill="var(--c-panel)" />
          </svg>
          Запечатать лабораторию
        </button>
      </div>
    </div>
  )
}
