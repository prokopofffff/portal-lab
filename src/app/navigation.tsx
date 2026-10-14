// Минимальный экранный роутер в памяти: без URL и библиотек (docs/spec.md §9)
// Провайдер и хуки — один модуль по контракту; fast refresh этого файла даёт полную перезагрузку
/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type Route =
  | { screen: 'hall' }
  | { screen: 'atlas' }
  | { screen: 'world'; world: string }
  | { screen: 'journal' }
  | { screen: 'portal'; portal: string }

type Navigate = (route: Route) => void

const RouteContext = createContext<Route | null>(null)
const NavigateContext = createContext<Navigate | null>(null)

// Хранит текущий экран для всего приложения; по умолчанию — зал
export function NavigationProvider(props: { initialRoute?: Route; children: ReactNode }) {
  const [route, setRoute] = useState<Route>(props.initialRoute ?? { screen: 'hall' })
  const navigate = useCallback<Navigate>((next) => setRoute(next), [])
  // Отдельные контексты: кнопки с navigate не перерисовываются при смене экрана
  return (
    <NavigateContext.Provider value={navigate}>
      <RouteContext.Provider value={route}>{props.children}</RouteContext.Provider>
    </NavigateContext.Provider>
  )
}

// Текущий экран; вне провайдера — ошибка
export function useRoute(): Route {
  const route = useContext(RouteContext)
  if (route === null) throw new Error('useRoute: нет NavigationProvider')
  return route
}

// Переход на другой экран; вне провайдера — ошибка
export function useNavigate(): Navigate {
  const navigate = useContext(NavigateContext)
  if (navigate === null) throw new Error('useNavigate: нет NavigationProvider')
  return navigate
}
