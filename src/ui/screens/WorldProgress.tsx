import type { WorldStats } from '../../domain'

/** Полоска изучения мира: изученные существа и, лиловым, доля следующего. */
export function WorldProgress({
  stats,
  height,
}: {
  stats: Pick<WorldStats, 'full' | 'donePct' | 'nextBarPct'>
  height: 12 | 14
}) {
  const inner = height - 4
  return (
    <span
      role="meter"
      aria-label="Прогресс мира"
      aria-valuenow={stats.donePct}
      aria-valuemin={0}
      aria-valuemax={100}
      // Доля строки (flex) — в классе world-meter: на узком экране полоска уходит на свою строку
      className="world-meter"
      style={{
        height,
        boxSizing: 'border-box',
        padding: 2,
        background: 'var(--c-ink-title)',
        display: 'flex',
      }}
    >
      <span
        style={{
          display: 'block',
          height: inner,
          width: `${stats.donePct}%`,
          background: `repeating-linear-gradient(90deg,${stats.full ? 'var(--c-bar-studied)' : 'var(--c-bar-study)'} 0 8px,transparent 8px 10px)`,
        }}
      />
      <span
        style={{
          display: 'block',
          height: inner,
          width: `${stats.nextBarPct}%`,
          background:
            'repeating-linear-gradient(90deg,var(--c-bar-study-next) 0 8px,transparent 8px 10px)',
        }}
      />
    </span>
  )
}
