import type { CSSProperties, ReactNode } from 'react'
import { useNavigate, type Route } from '../../app/navigation'

/**
 * Ссылка на другой экран: роль link, без перезагрузки страницы. Без href: у экранов нет адресов,
 * и клик с модификатором или «открыть в новой вкладке» подняли бы вторую копию игры над тем же
 * сохранением.
 */
export function RouteLink({
  to,
  style,
  className,
  current,
  tour,
  children,
}: {
  to: Route
  style?: CSSProperties
  className?: string
  /** Ссылка ведёт на текущий экран. */
  current?: boolean
  /** Цель подсказки обучения (data-tour). */
  tour?: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <a
      role="link"
      tabIndex={0}
      className={className}
      aria-current={current ? 'page' : undefined}
      data-tour={tour}
      style={{ cursor: 'pointer', ...style }}
      onClick={() => navigate(to)}
      onKeyDown={(event) => {
        // Как у настоящей ссылки: Enter, а не пробел
        if (event.key !== 'Enter') return
        event.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
