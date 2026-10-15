import type { CSSProperties } from 'react'
import type { Command } from '../../domain'
import { Portal, Rune } from '../sprites'
import type { RiskLevel } from '../theme/tokens'
import { Abilities } from './CardAbilities'
import { Metrics, RiskBox, type CardDelta, type CardPalette } from './CardMetrics'
import type { PortalCardModel } from './cardModel'
import { Advice, History, Study } from './CardSections'
import './card.css'

// Карточка портала (канвас 23-c-portal-card): рисует готовую модель portalCard(), сама ничего не считает.
// Размеры, шрифты и отступы — дословно из исходника кадра; цвета — CSS-переменные токенов.

export type { CardDelta } from './CardMetrics'

export interface PortalCardProps {
  model: PortalCardModel
  onAction: (command: Command) => void
  onOpenWorld: (world: string) => void
  onOpenPortal: (name: string) => void
  delta?: CardDelta
  /** id заголовка с именем портала — для aria-labelledby диалога. */
  headingId?: string
}

// Цвета рамки, балла и плашки риска по уровню; у архивной карточки — серые
function paletteOf(model: PortalCardModel): CardPalette {
  if (model.status !== 'open') {
    return {
      rc: 'var(--risk-archived-c)',
      dark: 'var(--c-archived-plate)',
      tx: 'var(--c-archived-text)',
    }
  }
  const level = model.risk.level
  return {
    rc: `var(--risk-${level}-c)`,
    dark: `var(--risk-${level}-plate)`,
    tx: `var(--risk-${level}-on)`,
  }
}

const pixel: CSSProperties = { fontFamily: 'var(--f-pixel)' }

// Сила свечения за порталом по уровню (glow в R канваса)
const glowStrength: Record<RiskLevel, string> = {
  low: '22%',
  medium: '24%',
  high: '32%',
  critical: '45%',
}

function Header({
  model,
  palette,
  headingId,
  onOpenWorld,
}: {
  model: PortalCardModel
  palette: CardPalette
  headingId?: string
  onOpenWorld: (world: string) => void
}) {
  const archived = model.status !== 'open'
  return (
    <div
      className="card-header"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        padding: '18px 20px 12px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <h2
          id={headingId}
          style={{
            ...pixel,
            margin: 0,
            fontWeight: 400,
            fontSize: 22,
            lineHeight: '26px',
            color: 'var(--c-row-title)',
          }}
        >
          {model.name}
        </h2>
        <button
          type="button"
          className="card-link card-link--underline"
          onClick={() => onOpenWorld(model.world)}
          style={{ fontSize: 17, fontWeight: 600, color: 'var(--c-shared-world)' }}
        >
          {model.world} <span aria-hidden="true">↗</span>
        </button>
      </div>
      <div className="card-header-tags" style={{ display: 'flex', gap: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 1,
            color: archived ? 'var(--c-archived-text)' : palette.tx,
            border: `2px solid ${palette.rc}`,
            background: archived ? 'var(--c-ability-off)' : palette.dark,
            padding: '2px 10px',
          }}
        >
          {model.statusWord}
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: palette.dark,
            color: palette.tx,
            padding: '4px 12px 4px 10px',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          <span aria-hidden="true" style={{ display: 'flex' }}>
            <Rune level={archived ? 'archived' : model.risk.level} size={16} />
          </span>
          {model.lastRisk ?? `${model.risk.label} · ${model.risk.score}`}
        </span>
      </div>
    </div>
  )
}

/** Окно со сценой: сетка, свечение, пол, портал; у архива — штамп, у отмеченного — записка. */
function Scene({ model }: { model: PortalCardModel }) {
  const archived = model.status !== 'open'
  const level = model.risk.level
  return (
    <div
      style={{
        position: 'relative',
        height: 196,
        margin: '0 20px',
        overflow: 'hidden',
        backgroundColor: 'var(--c-row-stage)',
        backgroundImage:
          'repeating-linear-gradient(0deg,transparent 0 23px,var(--c-scene-grid) 23px 24px),' +
          'repeating-linear-gradient(90deg,transparent 0 47px,var(--c-scene-grid) 47px 48px)',
        boxShadow: 'inset 0 0 0 3px var(--c-edge-soft)',
      }}
    >
      {!archived && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            // Не шире сцены: на узкой карточке рядом с полосой прокрутки сцена уже 300 px
            width: 300,
            maxWidth: '100%',
            height: 300,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(closest-side, color-mix(in srgb, var(--risk-${level}-c) ${glowStrength[level]}, transparent), transparent)`,
          }}
        />
      )}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 22,
          background:
            'repeating-linear-gradient(90deg,var(--c-scene-floor) 0 36px,var(--c-scene-grid) 36px 40px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 12,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Portal
          look={archived ? 'archived' : level}
          observers={model.study.observers}
          width={136}
        />
      </div>
      {archived && (
        <span
          aria-hidden="true"
          style={{
            ...pixel,
            position: 'absolute',
            left: '50%',
            top: '52%',
            transform: 'translate(-50%,-50%) rotate(-8deg)',
            fontSize: 20,
            color: 'var(--c-stamp)',
            border: '4px double var(--c-stamp)',
            padding: '8px 14px',
            background: 'color-mix(in srgb, var(--c-night) 55%, transparent)',
            whiteSpace: 'nowrap',
          }}
        >
          {model.statusWord}
        </span>
      )}
      {model.questioned && (
        <div
          className="card-notch"
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            width: 196,
            boxSizing: 'border-box',
            padding: '14px 12px 10px',
            background: 'var(--c-sticky-note)',
            color: 'var(--c-sticky-note-ink)',
            boxShadow: 'inset 0 -4px 0 var(--c-sticky-note-shade)',
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
          <span
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 1,
              marginBottom: 3,
            }}
          >
            ПОД ВОПРОСОМ
          </span>
          {model.questioned.note && (
            <span
              style={{
                fontFamily: 'var(--f-prose)',
                fontSize: 15,
                lineHeight: '18px',
                display: 'block',
                textWrap: 'pretty',
              }}
            >
              {model.questioned.note}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** Карточка портала целиком; команды уходят наверх через onAction, переходы — через onOpen*. */
export function PortalCard({
  model,
  onAction,
  onOpenWorld,
  onOpenPortal,
  delta,
  headingId,
}: PortalCardProps) {
  const archived = model.status !== 'open'
  const palette = paletteOf(model)
  return (
    <div
      data-status={model.status}
      data-level={archived ? 'archived' : model.risk.level}
      className="card-frame"
      style={{
        fontFamily: 'var(--f-ui)',
        color: 'var(--c-text)',
        filter: archived ? 'grayscale(.85) sepia(.3) brightness(.82)' : 'none',
      }}
    >
      <div className="card-notch" style={{ background: palette.rc, padding: 6 }}>
        <div
          className="card-notch"
          style={{ background: 'var(--s-sill)', boxShadow: 'inset 0 0 0 3px var(--c-edge-soft)' }}
        >
          <Header model={model} palette={palette} headingId={headingId} onOpenWorld={onOpenWorld} />
          <Scene model={model} />
          <Metrics model={model} delta={delta} />
          <RiskBox model={model} palette={palette} delta={delta} />
          <Study model={model} onOpenPortal={onOpenPortal} />
          {model.advice && <Advice advice={model.advice} />}
          {model.abilities.length > 0 && (
            <Abilities portal={model.name} abilities={model.abilities} onAction={onAction} />
          )}
          {model.archive && (
            <p
              style={{
                margin: '14px 20px 0',
                padding: '10px 14px',
                background: 'var(--c-row-stage)',
                boxShadow: 'inset 0 0 0 2px var(--c-edge)',
                fontFamily: 'var(--f-prose)',
                fontSize: 16,
                fontStyle: 'italic',
                color: 'var(--c-text-muted)',
              }}
            >
              {model.archive}
            </p>
          )}
          <History history={model.history} />
        </div>
      </div>
    </div>
  )
}
