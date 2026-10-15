import type { CSSProperties, ReactNode } from 'react'

/**
 * Погреб за экраном: тёмный кирпич с виньеткой, как в канвасе. HUD и док рисует приложение.
 * Отступы идут через переменную --screen-pad в класс screen-frame: на узком экране их заменяет
 * media query.
 */
export function ScreenFrame({
  gap = 18,
  padding = '22px 48px 26px',
  children,
}: {
  gap?: number
  padding?: string
  children: ReactNode
}) {
  return (
    <main
      className="screen-frame"
      style={
        {
          '--screen-pad': padding,
          flex: '1 1 auto',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap,
          backgroundColor: 'var(--c-cellar)',
          backgroundImage:
            'repeating-linear-gradient(0deg,transparent 0 15px,var(--c-cellar-seam) 15px 16px)',
          boxShadow: 'inset 0 0 140px rgba(0,0,0,.7)',
        } as CSSProperties
      }
    >
      {children}
    </main>
  )
}
