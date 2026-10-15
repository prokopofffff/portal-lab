import { useEffect, useId, useRef, useState } from 'react'

export interface Choice<T extends string> {
  value: T
  label: string
}

/**
 * Закладка-фильтр книги журнала: лента с названием и текущим значением, по нажатию — список
 * значений. Раскрытие по образцу disclosure: aria-expanded и aria-controls без aria-haspopup —
 * тот обещал бы меню или listbox со стрелками, а в списке обычные кнопки, по ним ходят Tab.
 */
export function Ribbon<T extends string>({
  label,
  allLabel,
  background,
  choices,
  selected,
  onSelect,
}: {
  label: string
  allLabel: string
  background: string
  choices: Choice<T>[]
  selected: T | undefined
  onSelect: (value: T | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Список закрывается по Escape и по нажатию вне закладки
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointer = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  const all = { value: undefined, label: allLabel }
  const current = choices.find((c) => c.value === selected) ?? all
  // Отступление от кадра 14: там у закладки нет активного вида, и фильтр видно только по третьей
  // строке. Закладка с выбранным значением выдвинута и со светлой каймой (класс journal-tab--active)
  const active = selected !== undefined
  return (
    <div ref={root} className="journal-ribbon">
      <button
        type="button"
        className={active ? 'journal-tab journal-tab--active' : 'journal-tab'}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '6px 14px 18px',
          textAlign: 'left',
          fontFamily: 'var(--f-ui)',
          fontSize: 15,
          fontWeight: 600,
          lineHeight: '17px',
          color: 'var(--c-on-ribbon)',
          background,
          border: 0,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: '.5px',
            color: 'var(--c-ribbon-label)',
          }}
        >
          закладка
        </span>
        <span>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--c-ribbon-label)' }}>
          {current.label}
        </span>
      </button>
      {open && (
        <div
          id={listId}
          role="group"
          aria-label={label}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 5,
            width: 240,
            maxHeight: 320,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--c-tab)',
            border: '3px solid var(--c-parchment-edge)',
          }}
        >
          {[all, ...choices].map((choice) => (
            <button
              key={choice.value ?? ''}
              type="button"
              aria-pressed={choice.value === selected}
              onClick={() => {
                onSelect(choice.value)
                setOpen(false)
              }}
              style={{
                padding: '9px 14px',
                textAlign: 'left',
                fontFamily: 'var(--f-ui)',
                fontSize: 15,
                fontWeight: choice.value === selected ? 600 : 400,
                color: 'var(--c-parchment)',
                background: choice.value === selected ? 'var(--c-parchment-edge)' : 'transparent',
                border: 0,
                cursor: 'pointer',
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
