import type { CSSProperties } from 'react'
import { useLabSelector } from '../../app/hooks'
import { useNavigate } from '../../app/navigation'
import { attentionList, type AttentionItem } from '../../domain'
import { risk } from '../theme/tokens'
import { Rune } from '../sprites'

// Слот под записки: высота зала не прыгает, что бы в нём ни стояло
const slot: CSSProperties = { height: 90, marginBottom: 8 }

function Note({ item, onOpen }: { item: AttentionItem; onOpen: () => void }) {
  const level = item.level
  return (
    <button
      type="button"
      className="hall-notch hall-note"
      onClick={onOpen}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        textAlign: 'left',
        padding: '12px 14px 8px',
        background: 'var(--c-parchment)',
        border: 0,
        color: 'var(--c-ink-title)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: 'inset 0 -4px 0 var(--c-parchment-shade)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 3,
          left: '50%',
          width: 8,
          height: 8,
          background: 'var(--c-pin)',
          boxShadow: '0 2px 0 var(--c-pin-shade)',
        }}
      />
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: `var(--risk-${level}-plate)`,
            color: `var(--risk-${level}-on)`,
            padding: '1px 8px 1px 6px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          <span aria-hidden="true" style={{ display: 'flex' }}>
            <Rune level={level} size={12} />
          </span>
          {risk[level].label.toUpperCase()}
        </span>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-ink-title)' }}>
          {item.portal} · {item.world}
        </span>
      </span>
      <span
        style={{
          fontFamily: 'var(--f-prose)',
          fontSize: 15,
          lineHeight: '18px',
          color: 'var(--c-ink-body)',
          textWrap: 'pretty',
        }}
      >
        {item.reason}
      </span>
    </button>
  )
}

/**
 * Записки «Тревожных знаков» (spec §7, канвас 00-hall): до трёх порталов, требующих внимания.
 * Порядок, лимит и «принятые не показываются» решает домен (attentionList). Записка открывает
 * карточку портала поверх зала.
 */
export function AlarmNotes() {
  const lab = useLabSelector((state) => state.lab)
  const navigate = useNavigate()
  const items = attentionList(lab)

  if (items.length === 0) {
    // Открытые порталы есть, но все приняты как есть: слот остаётся, тихая панель вместо записок
    return (
      <div
        role="region"
        aria-label="Тревожные знаки"
        className="hall-notch"
        style={{
          ...slot,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--c-control)',
          boxShadow: 'inset 0 0 0 3px var(--c-edge)',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, fontSize: 20, color: 'var(--c-text-muted)' }}>
          Тревожных знаков нет — все открытые порталы приняты как есть
        </p>
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-label="Тревожные знаки"
      style={{
        ...slot,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 14,
      }}
    >
      {items.map((item) => (
        <Note
          key={item.portal}
          item={item}
          onOpen={() =>
            navigate({ screen: 'portal', portal: item.portal, back: { screen: 'hall' } })
          }
        />
      ))}
    </div>
  )
}
