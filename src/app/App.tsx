import type { ReactNode } from 'react'
import { Bar, Creatures, Portal } from '../ui/sprites'
import type { PortalLook } from '../ui/theme/tokens'

const looks: PortalLook[] = ['empty', 'low', 'medium', 'high', 'critical', 'archived']
const observerExamples: [PortalLook, number][] = [
  ['low', 1],
  ['medium', 2],
  ['high', 3],
]

const sectionTitle = {
  fontFamily: 'var(--f-pixel)',
  fontSize: 12,
  color: 'var(--c-text-muted)',
  margin: '0 0 12px',
} as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={sectionTitle}>{title}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        {children}
      </div>
    </section>
  )
}

export function App() {
  return (
    <main style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <h1
        style={{ fontFamily: 'var(--f-pixel)', fontSize: 20, color: 'var(--c-torch)', margin: 0 }}
      >
        Лаборатория порталов
      </h1>
      <p style={{ fontFamily: 'var(--f-prose)', color: 'var(--c-text-soft)', margin: 0 }}>
        Галерея спрайтов. Зал лаборатории появится здесь.
      </p>
      <Section title="Порталы">
        {looks.map((look) => (
          <Portal key={look} look={look} />
        ))}
      </Section>
      <Section title="Наблюдатели у арки">
        {observerExamples.map(([look, n]) => (
          <Portal key={n} look={look} observers={n} />
        ))}
      </Section>
      <Section title="Полоски">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 280 }}>
          <Bar label="Энергия" value={72} />
          <Bar label="Стабильность" value={38} tone="medium" />
          <Bar label="Время" value={24} max={400} tone="critical" />
          <Bar label="Изучение" value={55} tone="low" />
        </div>
      </Section>
      <Section title="Существа">
        <Creatures total={9} studied={3} />
        <Creatures total={5} studied={5} />
        <Creatures total={0} studied={0} />
      </Section>
    </main>
  )
}
