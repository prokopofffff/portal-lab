import type { CSSProperties, ReactNode } from 'react'
import { Dock } from '../ui/hud/Dock'
import { Hud } from '../ui/hud/Hud'
import { AtlasScreen } from '../ui/screens/AtlasScreen'
import { JournalScreen } from '../ui/screens/JournalScreen'
import { PortalStub } from '../ui/screens/PortalStub'
import { WorldScreen } from '../ui/screens/WorldScreen'
import { Bar, Creatures, Portal, RiskTag } from '../ui/sprites'
import type { PortalLook } from '../ui/theme/tokens'
import { useDispatch, useSpeed } from './hooks'
import { NavigationProvider, useRoute } from './navigation'

// Колонки «Языка риска»: у критического портала стоят двое наблюдателей, как в канвасе.
const looks: [PortalLook, number][] = [
  ['empty', 0],
  ['low', 0],
  ['medium', 0],
  ['high', 0],
  ['critical', 2],
  ['archived', 0],
]
const observerExamples: [PortalLook, number][] = [
  ['low', 1],
  ['medium', 2],
  ['high', 3],
]
const bars: { label: string; value: number; shown: string; color: string }[] = [
  { label: 'Энергия', value: 82, shown: '82', color: 'var(--risk-high-c)' },
  { label: 'Стабильность', value: 14, shown: '14', color: 'var(--risk-critical-c)' },
  { label: 'Изучение', value: 40, shown: '40 %', color: 'var(--s-study)' },
]

const sectionTitle: CSSProperties = {
  fontFamily: 'var(--f-pixel)',
  fontSize: 12,
  color: 'var(--c-text-muted)',
  margin: '0 0 16px',
}

const column: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  padding: '22px 10px 16px',
  background: 'var(--c-panel)',
  boxShadow: 'inset 0 0 0 3px var(--c-edge-soft)',
}

const stage: CSSProperties = {
  height: 200,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  paddingBottom: 10,
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

// Галерея спрайтов вместо зала: lab-9dr.4 заменит её настоящим залом
function HallGallery() {
  return (
    <main
      style={{
        flex: '1 1 auto',
        padding: '32px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}
    >
      <h1
        style={{ fontFamily: 'var(--f-pixel)', fontSize: 20, color: 'var(--c-torch)', margin: 0 }}
      >
        Лаборатория порталов
      </h1>
      <p style={{ fontFamily: 'var(--f-prose)', color: 'var(--c-text-soft)', margin: 0 }}>
        Галерея спрайтов. Зал лаборатории появится здесь.
      </p>
      <Section title="Язык риска">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12 }}>
          {looks.map(([look, observers]) => (
            <div key={look} style={column}>
              <div style={stage}>
                <Portal look={look} observers={observers} width={130} />
              </div>
              <RiskTag look={look} />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Наблюдатели у арки">
        <div style={{ display: 'flex', gap: 48, paddingBottom: 16 }}>
          {observerExamples.map(([look, n]) => (
            <Portal key={n} look={look} observers={n} />
          ))}
        </div>
      </Section>
      <Section title="Полоски">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: 640 }}>
          {bars.map(({ label, value, shown, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                aria-hidden="true"
                style={{ width: 140, fontSize: 16, color: 'var(--c-text-soft)' }}
              >
                {label}
              </span>
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <Bar label={label} value={value} color={color} segments={20} height={12} />
              </div>
              <span
                aria-hidden="true"
                style={{
                  width: 104,
                  textAlign: 'right',
                  fontWeight: 600,
                  fontSize: 21,
                  lineHeight: '22px',
                  color: 'var(--c-text)',
                }}
              >
                {shown}
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Существа">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Creatures total={9} studied={3} progress={40} size={40} />
          <Creatures total={9} studied={9} size={40} />
          <Creatures total={0} studied={0} />
        </div>
      </Section>
    </main>
  )
}

// Экран по текущему маршруту
function Screen() {
  const route = useRoute()
  switch (route.screen) {
    case 'hall':
      return <HallGallery />
    case 'atlas':
      return <AtlasScreen />
    case 'world':
      return <WorldScreen world={route.world} />
    case 'portal':
      return <PortalStub portal={route.portal} />
    case 'journal':
      return <JournalScreen />
  }
}

const SEAL_QUESTION =
  'Запечатать лабораторию? Все порталы, журнал и время будут удалены, штат вернётся к трём наблюдателям.'

// HUD сверху, экран посередине, док снизу; на паузе корень замораживает анимации
function Shell() {
  const [speed] = useSpeed()
  const dispatch = useDispatch()
  // Подтверждение печати (spec §5, §9): window.confirm до диалога-свитка lab-9dr.7
  const seal = () => {
    if (window.confirm(SEAL_QUESTION)) dispatch({ type: 'sealLab' })
  }
  return (
    <div
      className={speed === 0 ? 'is-paused' : undefined}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <Hud />
      <Screen />
      <Dock onSeal={seal} />
    </div>
  )
}

export function App() {
  return (
    <NavigationProvider>
      <Shell />
    </NavigationProvider>
  )
}
