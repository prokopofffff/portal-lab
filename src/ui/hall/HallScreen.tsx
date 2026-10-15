import { useCallback, useState, type CSSProperties } from 'react'
import { useDispatch, useLabSelector, useSpeed } from '../../app/hooks'
import { useNavigate } from '../../app/navigation'
import type { Lab } from '../../domain'
import { EmptyArch, LeavingArch, PortalArch } from './ArchCell'
import { ARCH_COUNT, departures, hallCells, type Departure } from './hallCells'
import './hall.css'

// Факелы на стене между арками: левый край, середина, правый край в каждом ряду (канвас 00-hall)
const TORCHES: readonly (readonly [left: string, top: string])[] = [
  ['1%', '2%'],
  ['49.2%', '2%'],
  ['97%', '2%'],
  ['1%', '53%'],
  ['49.2%', '53%'],
  ['97%', '53%'],
]

function Torch({ left, top }: { left: string; top: string }) {
  return (
    <svg
      className="hall-flame"
      viewBox="0 0 7 16"
      width={21}
      height={48}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left,
        top,
        filter: 'drop-shadow(0 0 10px color-mix(in srgb, var(--s-flame) 66.7%, transparent))',
      }}
    >
      <path d="M3,8h1v8h-1z M2,7h3v1h-3z" fill="var(--s-torch-handle)" />
      <path d="M3,0h1v1h-1z M2,1h3v2h-3z M1,3h5v3h-5z M2,6h3v1h-3z" fill="var(--s-flame)" />
      <path d="M3,2h1v1h-1z M2,3h3v3h-3z" fill="var(--s-flame-core)" />
      <path d="M3,4h1v2h-1z" fill="var(--s-flame-heart)" />
    </svg>
  )
}

const banner: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 16,
  fontWeight: 600,
  padding: '2px 10px',
}

function FullBanner() {
  return (
    <span
      style={{
        ...banner,
        color: 'var(--c-full-banner)',
        background: 'var(--c-full-banner-bg)',
        border: '2px solid var(--risk-critical-c)',
      }}
    >
      Все 12 арок заняты — открыть новый портал некуда
    </span>
  )
}

function PausedBanner() {
  return (
    <span
      style={{
        ...banner,
        color: 'var(--c-pause-banner)',
        background: 'var(--c-observer-free-bg)',
        border: '2px solid var(--c-pause-on)',
      }}
    >
      <svg viewBox="0 0 7 8" width={10} height={12} shapeRendering="crispEdges" aria-hidden="true">
        <path d="M0,0h3v8h-3z M4,0h3v8h-3z" fill="currentColor" />
      </svg>
      Пауза: время стоит, песок замер
    </span>
  )
}

function QuestionedToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label
      className="hall-toggle"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 15,
        color: 'var(--c-text-soft)',
        cursor: 'pointer',
      }}
    >
      <span>Под вопросом</span>
      <span
        className="hall-toggle__track"
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: on ? 'flex-end' : 'flex-start',
          width: 44,
          height: 20,
          boxSizing: 'border-box',
          padding: 2,
          background: on ? 'var(--risk-medium-plate)' : 'var(--c-well)',
          border: '2px solid var(--s-stone-light)',
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            background: on ? 'var(--risk-medium-c)' : 'var(--s-stone-light)',
          }}
        />
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        aria-label="Показать только порталы «под вопросом»"
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1, margin: 0 }}
      />
    </label>
  )
}

/**
 * Порталы, которые прямо сейчас уходят из арок. Новая лаборатория сравнивается с прежней прямо
 * в рендере, чтобы арка ни кадра не мелькнула пустой; сцена живёт, пока её не займёт новый портал
 * или пока не дотает табличка (finish).
 */
function useDepartures(lab: Lab): [Departure[], (name: string) => void] {
  const [seen, setSeen] = useState(lab)
  const [leaving, setLeaving] = useState<Departure[]>([])
  if (seen !== lab) {
    setSeen(lab)
    const fresh = departures(seen, lab)
    const known = new Set(lab.portals.map((p) => p.name))
    const taken = new Set(lab.portals.filter((p) => p.status === 'open').map((p) => p.arch))
    // Печать лаборатории стирает порталы — их сцены тоже
    const keep = (d: Departure) => known.has(d.cell.name) && !taken.has(d.cell.arch)
    if (fresh.length > 0 || !leaving.every(keep)) {
      setLeaving((prev) => [...prev, ...fresh].filter(keep))
    }
  }
  const finish = useCallback(
    (name: string) => setLeaving((prev) => prev.filter((d) => d.cell.name !== name)),
    [],
  )
  return [leaving, finish]
}

/**
 * Зал лаборатории (spec §9, канвас 00–03-hall): 12 арок — лимит открытых порталов.
 * focus — портал, чья карточка открыта: его арка обведена пунктиром.
 */
export function HallScreen({ focus }: { focus?: string }) {
  const lab = useLabSelector((state) => state.lab)
  const [speed] = useSpeed()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [onlyQuestioned, setOnlyQuestioned] = useState(false)
  const [leaving, finish] = useDepartures(lab)

  const cells = hallCells(lab)
  const open = cells.filter((c) => c.kind === 'portal').length
  const paused = speed === 0
  const openPortal = () => dispatch({ type: 'openPortal' })

  return (
    <main
      style={{
        // Как кадр 00-hall (1000 px − HUD 112 − док 84): зал делит высоту экрана, а не растёт по
        // содержимому; ниже 804 px не сжимается — экран прокручивается
        flex: '1 1 0',
        minHeight: 804,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 28px 12px',
        boxSizing: 'border-box',
        backgroundColor: 'var(--c-stone)',
        backgroundImage:
          'repeating-linear-gradient(0deg,transparent 0 31px,var(--c-stone-seam) 31px 32px),repeating-linear-gradient(90deg,transparent 0 63px,var(--c-stone-seam) 63px 64px)',
        boxShadow: 'inset 0 0 140px rgba(0,0,0,.65)',
        filter: paused ? 'brightness(.55) saturate(.6)' : 'none',
      }}
    >
      <h1 className="hall-sr">Лаборатория порталов</h1>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          height: 22,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--f-pixel)',
            fontSize: 11,
            color: 'var(--c-torch)',
            letterSpacing: 1,
          }}
        >
          ТРЕВОЖНЫЕ ЗНАКИ
        </span>
        <div role="status" style={{ display: 'flex', gap: 12 }}>
          {open >= ARCH_COUNT && <FullBanner />}
          {paused && <PausedBanner />}
        </div>
        <QuestionedToggle on={onlyQuestioned} onChange={setOnlyQuestioned} />
      </div>

      {/* Записки «Тревожных знаков» — lab-9dr.5; пока порталов нет, здесь приглашение */}
      {open === 0 && (
        <div
          className="hall-notch"
          style={{
            height: 90,
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--c-control)',
            boxShadow: 'inset 0 0 0 3px var(--c-edge)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              fontSize: 26,
              color: 'var(--c-torch-light)',
            }}
          >
            Порталов нет — активируйте первую арку
          </p>
        </div>
      )}

      <div
        style={{
          position: 'relative',
          flex: '1 1 0',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${ARCH_COUNT / 2}, minmax(0, 1fr))`,
          gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
          gap: '4px 0',
        }}
      >
        {TORCHES.map(([left, top]) => (
          <Torch key={`${left},${top}`} left={left} top={top} />
        ))}
        {cells.map((cell) => {
          if (cell.kind === 'portal') {
            return (
              <PortalArch
                key={cell.name}
                cell={cell}
                dimmed={onlyQuestioned && !cell.questioned}
                focused={cell.name === focus}
                onOpen={() =>
                  navigate({ screen: 'portal', portal: cell.name, back: { screen: 'hall' } })
                }
              />
            )
          }
          const departure = leaving.find((d) => d.cell.arch === cell.arch)
          if (departure) {
            return (
              <LeavingArch
                key={departure.cell.name}
                departure={departure}
                dimmed={onlyQuestioned}
                onDone={() => finish(departure.cell.name)}
              />
            )
          }
          return (
            <EmptyArch
              key={`arch-${cell.arch}`}
              arch={cell.arch}
              invite={open === 0 && cell.arch === 0}
              dimmed={onlyQuestioned}
              onOpenPortal={openPortal}
            />
          )
        })}
      </div>
    </main>
  )
}
