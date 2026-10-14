import { risk } from '../ui/theme/tokens'

export function App() {
  return (
    <main style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1
        style={{ fontFamily: 'var(--f-pixel)', fontSize: 20, color: 'var(--c-torch)', margin: 0 }}
      >
        Лаборатория порталов
      </h1>
      <p style={{ fontFamily: 'var(--f-prose)', color: 'var(--c-text-soft)', margin: 0 }}>
        Каркас готов. Зал лаборатории появится здесь.
      </p>
      <ul
        aria-label="Уровни риска"
        style={{ display: 'flex', gap: 8, padding: 0, margin: 0, listStyle: 'none' }}
      >
        {Object.entries(risk).map(([level, r]) => (
          <li
            key={level}
            style={{ background: r.plate, color: r.onPlate, padding: '4px 12px', fontWeight: 600 }}
          >
            {r.label}
          </li>
        ))}
      </ul>
    </main>
  )
}
