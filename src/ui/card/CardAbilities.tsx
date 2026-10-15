import { useId, useState } from 'react'
import type { Command } from '../../domain'
import type { AbilityCommand, CardAbility } from './cardModel'

// Способности карточки портала (канвас 23-c-portal-card): шесть кнопок, подсказка отказа, перезарядка.

// Иконки способностей 8×8 (ICON канваса)
const ABILITY_ICONS: Record<AbilityCommand, string> = {
  stabilize: 'M1,0h5v1h-5z M0,1h7v4h-7z M1,5h5v1h-5z M2,6h3v1h-3z',
  closePortal: 'M2,0h3v1h-3z M1,1h1v2h-1z M5,1h1v2h-1z M0,3h7v4h-7z',
  sendObserver: 'M0,3h4v1h-4z M4,1h1v5h-1z M5,2h1v3h-1z M6,3h1v1h-1z',
  recallObservers: 'M3,3h4v1h-4z M2,1h1v5h-1z M1,2h1v3h-1z M0,3h1v1h-1z',
  toggleQuestioned: 'M2,0h4v1h-4z M1,1h2v1h-2z M5,1h2v1h-2z M4,2h2v1h-2z M3,3h2v2h-2z M3,6h2v2h-2z',
  acceptAsIs:
    'M0,4h1v1h-1z M1,5h1v1h-1z M2,6h1v1h-1z M3,5h1v1h-1z M4,4h1v1h-1z M5,3h1v1h-1z M6,2h1v1h-1z M7,1h1v1h-1z',
}

const SHADE = 'inset 0 -4px 0 var(--c-ability-shade)'

function abilityLook(ability: CardAbility) {
  const off = !ability.available
  const rec = ability.recommended
  return {
    fg: off ? 'var(--c-text-faint)' : rec ? 'var(--c-ability-rec-text)' : 'var(--c-text)',
    ic: off ? 'var(--c-ability-off-icon)' : rec ? 'var(--c-torch-light)' : 'var(--c-torch)',
    bg: off ? 'var(--c-ability-off)' : rec ? 'var(--c-ability-rec)' : 'var(--c-ability)',
    bd: off ? 'var(--c-edge)' : rec ? 'var(--c-torch-light)' : 'var(--c-ability-edge)',
    sh: rec
      ? `0 0 0 2px var(--c-well), 0 0 14px color-mix(in srgb, var(--c-torch) 53.3%, transparent), ${SHADE}`
      : SHADE,
    op: off ? 0.5 : 1,
  }
}

/**
 * Способность: недоступная приглушена, но кликабельна (aria-disabled, не disabled) — клик
 * отдаёт команду, и домен отвечает отказом. Причина — подсказка над кнопкой при наведении и фокусе.
 */
function Ability({ ability, onPress }: { ability: CardAbility; onPress: () => void }) {
  const tipId = useId()
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const reason = ability.available ? null : ability.reason
  const look = abilityLook(ability)
  const cd = ability.cooldown
  return (
    <div
      className="card-ability-slot"
      style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setDismissed(false)
      }}
    >
      {reason && (
        <div
          id={tipId}
          role="tooltip"
          hidden={!(hover || focus) || dismissed}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 'calc(100% + 10px)',
            transform: 'translateX(-50%)',
            width: 260,
            boxSizing: 'border-box',
            padding: '8px 12px',
            background: 'var(--c-well)',
            border: '3px solid var(--c-legend-rejection)',
            color: 'var(--c-tip-text)',
            fontSize: 15,
            lineHeight: '18px',
            textAlign: 'center',
            zIndex: 3,
            // Подсказка висит над соседней способностью: клик проходит сквозь неё к кнопке
            pointerEvents: 'none',
          }}
        >
          {reason}
        </div>
      )}
      <button
        type="button"
        className="card-ability"
        aria-disabled={ability.available ? undefined : true}
        aria-describedby={reason ? tipId : undefined}
        data-recommended={ability.recommended}
        onClick={onPress}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false)
          setDismissed(false)
        }}
        onKeyDown={(e) => {
          // Esc сначала прячет подсказку отказа; следующий Esc уже закрывает карточку
          if (e.key === 'Escape' && reason && (hover || focus) && !dismissed) {
            e.preventDefault()
            setDismissed(true)
          }
        }}
        style={{
          width: '100%',
          minHeight: 54,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 10px',
          fontFamily: 'var(--f-ui)',
          fontSize: 17,
          fontWeight: 600,
          lineHeight: '19px',
          textAlign: 'left',
          textWrap: 'balance',
          overflowWrap: 'normal',
          hyphens: 'none',
          color: look.fg,
          background: look.bg,
          border: `3px solid ${look.bd}`,
          boxShadow: look.sh,
          opacity: look.op,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            position: 'relative',
            flex: 'none',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            viewBox="0 0 8 8"
            width={22}
            height={22}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <path d={ABILITY_ICONS[ability.command]} fill={look.ic} />
          </svg>
          {cd && (
            <span
              aria-hidden="true"
              data-testid="cooldown"
              style={{
                position: 'absolute',
                inset: -2,
                borderRadius: '50%',
                background: `conic-gradient(var(--c-cooldown-shade) 0 ${Math.round(cd.elapsed * 100)}%, var(--c-cooldown-lit) 0)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--f-pixel)',
                fontSize: 8,
                color: 'var(--c-on-cooldown)',
              }}
            >
              {cd.left}
            </span>
          )}
        </span>
        <span>{ability.label}</span>
      </button>
    </div>
  )
}

/** Шесть способностей сеткой 2×3 (на узком экране, если не помещаются, — столбцом). */
export function Abilities({
  portal,
  abilities,
  onAction,
}: {
  portal: string
  abilities: CardAbility[]
  onAction: (command: Command) => void
}) {
  return (
    <div
      role="group"
      aria-label="Способности"
      // Столбцы сетки — в классе card-abilities: на узком экране их бывает один
      className="card-abilities"
      style={{
        position: 'relative',
        margin: '14px 20px 0',
        display: 'grid',
        gap: 8,
      }}
    >
      {abilities.map((ability) => (
        <Ability
          key={ability.command}
          ability={ability}
          onPress={() => onAction({ type: ability.command, portal })}
        />
      ))}
    </div>
  )
}
