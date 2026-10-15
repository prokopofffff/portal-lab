import type { CSSProperties, ReactNode } from 'react'
import { ScreenFrame } from '../screens/ScreenFrame'
import { worklog, type Stage } from './worklog'
import '../screens/screens.css'
import './worklog.css'

// Перо 9×9 — та же иконка, что у вкладки дока
const QUILL_ICON =
  'M6,0h3v1h-3z M5,1h2v1h-2z M8,1h1v1h-1z M4,2h2v1h-2z M7,2h1v1h-1z M3,3h2v1h-2z M6,3h1v1h-1z M3,4h1v1h-1z M5,4h1v1h-1z M2,5h3v1h-3z M2,6h2v1h-2z M1,7h1v1h-1z M0,8h1v1h-1z M3,8h6v1h-6z'

const prose: CSSProperties = {
  fontFamily: 'var(--f-prose)',
  fontSize: 17,
  lineHeight: '23px',
  color: 'var(--c-ink-body)',
}

// Подпись столбца этапа и шифр-плашка — как шифр мира в атласе
const plate: CSSProperties = {
  alignSelf: 'flex-start',
  fontFamily: 'var(--f-pixel)',
  fontSize: 10,
  color: 'var(--c-ink-label)',
  background: 'var(--c-parchment-plate)',
  padding: '4px 8px',
}

/** Пергаментная карточка раздела с рамкой и срезанными углами, как карточка мира в атласе. */
function Card({
  id,
  title,
  className,
  children,
}: {
  id: string
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className={['px-notch', className].filter(Boolean).join(' ')}
      style={{ background: 'var(--c-parchment-edge)', padding: 6 }}
    >
      <div
        className="px-notch"
        style={{
          height: '100%',
          boxSizing: 'border-box',
          background: 'var(--c-parchment)',
          color: 'var(--c-ink-title)',
          padding: '16px 20px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: 'inset 0 -5px 0 var(--c-parchment-shade)',
        }}
      >
        <h2
          id={id}
          style={{
            margin: 0,
            fontFamily: 'var(--f-ui)',
            fontWeight: 600,
            fontSize: 22,
            lineHeight: '26px',
            color: 'var(--c-ink-title)',
          }}
        >
          {title}
        </h2>
        {children}
      </div>
    </section>
  )
}

// Список с пиксельными квадратами вместо точек
function Bullets({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
      {items.map((item, i) => (
        <li key={i} style={{ ...prose, display: 'flex', gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              flex: 'none',
              width: 6,
              height: 6,
              marginTop: 9,
              background: 'var(--c-ink-label)',
            }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

// Крупное значение сводки: срок, токены
function Figure({ value, caption }: { value: string; caption: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--f-pixel)', fontSize: 22, color: 'var(--c-ink-title)' }}>
        {value}
      </span>
      <span style={{ ...prose, color: 'var(--c-ink-soft)' }}>{caption}</span>
    </div>
  )
}

function StageColumn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <span style={plate}>{label}</span>
      {children}
    </div>
  )
}

function StageRow({ stage, index }: { stage: Stage; index: number }) {
  return (
    <article
      className="worklog-stage"
      style={{ display: 'grid', paddingTop: 14, borderTop: '2px solid var(--c-parchment-line)' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--f-ui)',
            fontWeight: 600,
            fontSize: 19,
            lineHeight: '23px',
            color: 'var(--c-ink-title)',
          }}
        >
          <span style={{ color: 'var(--c-ink-label)' }}>{index + 1}. </span>
          {stage.title}
        </h3>
        <span style={{ fontSize: 14, color: 'var(--c-ink-time)' }}>{stage.dates}</span>
      </div>
      <StageColumn label="Человек">
        <Bullets items={stage.human} />
      </StageColumn>
      <StageColumn label="AI">
        <Bullets items={stage.ai} />
      </StageColumn>
      <StageColumn label="Суть запросов">
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
          {stage.prompts.map((prompt) => (
            <li
              key={prompt}
              style={{
                ...prose,
                fontStyle: 'italic',
                color: 'var(--c-ink-title)',
                borderLeft: '3px solid var(--c-ink-label)',
                paddingLeft: 10,
              }}
            >
              {prompt}
            </li>
          ))}
        </ul>
      </StageColumn>
    </article>
  )
}

/** AI Worklog: как приложение делалось с AI (требование сдачи; данные в worklog.ts). */
export function WorklogScreen() {
  const { tools, time, tokens, stages, decisions } = worklog
  return (
    <ScreenFrame>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg
            viewBox="0 0 9 9"
            width={36}
            height={36}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <path d={QUILL_ICON} fill="var(--c-cellar-icon)" />
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
            AI WORKLOG
          </h1>
        </div>
        <span style={{ fontSize: 14, color: 'var(--c-cellar-label)' }}>
          как лаборатория делалась с AI · на {worklog.asOf}
        </span>
      </div>

      <div className="worklog-summary" style={{ display: 'grid', gap: 18 }}>
        <Card id="worklog-tools" title="AI-инструменты">
          <Bullets
            items={tools.map((tool) => (
              <>
                <b style={{ fontWeight: 700, color: 'var(--c-ink-title)' }}>{tool.name}</b> —{' '}
                {tool.role}
              </>
            ))}
          />
        </Card>
        <Card id="worklog-time" title="Время разработки">
          <Figure value={time.value} caption={time.span} />
          <p style={{ ...prose, margin: 0, color: 'var(--c-ink-soft)' }}>{time.note}</p>
        </Card>
        <Card id="worklog-tokens" title="Токены">
          <Figure value={tokens.total} caption="Claude Code" />
          <dl
            style={{
              ...prose,
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'auto auto',
              justifyContent: 'start',
              gap: '4px 18px',
            }}
          >
            {tokens.rows.map((row) => (
              <div key={row.label} style={{ display: 'contents' }}>
                <dt>{row.label}</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: 'var(--c-ink-title)' }}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <p
            style={{
              ...prose,
              margin: 0,
              fontSize: 15,
              lineHeight: '20px',
              color: 'var(--c-ink-soft)',
            }}
          >
            {tokens.note}
          </p>
        </Card>
      </div>

      <Card id="worklog-stages" title="Этапы работы">
        <div style={{ display: 'grid', gap: 14 }}>
          {stages.map((stage, i) => (
            <StageRow key={stage.title} stage={stage} index={i} />
          ))}
        </div>
      </Card>

      <div className="worklog-grid" style={{ display: 'grid', gap: 18 }}>
        <Card id="worklog-decisions" title="Решения человека">
          <Bullets
            items={decisions.map((decision) => (
              <>
                <b style={{ fontWeight: 700, color: 'var(--c-ink-title)' }}>{decision.title}.</b>{' '}
                {decision.text}
              </>
            ))}
          />
        </Card>
        <Card id="worklog-mistakes" title="Где AI ошибся">
          <Bullets items={worklog.aiMistakes} />
        </Card>
        <Card id="worklog-manual" title="Что переписано вручную">
          <p style={{ ...prose, margin: 0 }}>{worklog.manual}</p>
        </Card>
        <Card id="worklog-verification" title="Как проверялось">
          <Bullets items={worklog.verification} />
        </Card>
        <Card id="worklog-improvements" title="Что улучшить" className="worklog-wide">
          <Bullets items={worklog.improvements} />
        </Card>
      </div>
    </ScreenFrame>
  )
}
