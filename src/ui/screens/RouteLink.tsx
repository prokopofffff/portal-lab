import type { CSSProperties, ReactNode } from 'react'
import { useNavigate, type Route } from '../../app/navigation'

/** Ссылка на другой экран: роль link, без перезагрузки страницы. */
export function RouteLink({
  to,
  style,
  className,
  current,
  children,
}: {
  to: Route
  style?: CSSProperties
  className?: string
  /** Ссылка ведёт на текущий экран. */
  current?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <a
      href="#"
      className={className}
      aria-current={current ? 'page' : undefined}
      style={style}
      onClick={(event) => {
        event.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
