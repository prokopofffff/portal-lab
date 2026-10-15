import { act, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { baseRoute, NavigationProvider, useNavigate, useRoute, type Route } from './navigation'

function wrapper(initialRoute?: Route) {
  return ({ children }: { children: ReactNode }) => (
    <NavigationProvider initialRoute={initialRoute}>{children}</NavigationProvider>
  )
}

describe('навигация между экранами', () => {
  it('начинает с зала', () => {
    const { result } = renderHook(() => useRoute(), { wrapper: wrapper() })
    expect(result.current).toEqual({ screen: 'hall' })
  })

  it('начальный маршрут можно задать', () => {
    const { result } = renderHook(() => useRoute(), {
      wrapper: wrapper({ screen: 'world', world: 'Пепельные Топи' }),
    })
    expect(result.current).toEqual({ screen: 'world', world: 'Пепельные Топи' })
  })

  it('navigate меняет маршрут, и компонент перерисовывается', () => {
    function Probe() {
      const route = useRoute()
      const navigate = useNavigate()
      return (
        <button onClick={() => navigate({ screen: 'portal', portal: 'ПТ-420-1' })}>
          {route.screen}
        </button>
      )
    }
    render(<Probe />, { wrapper: wrapper() })
    expect(screen.getByRole('button')).toHaveTextContent('hall')

    act(() => screen.getByRole('button').click())

    expect(screen.getByRole('button')).toHaveTextContent('portal')
  })

  it('карточка хранит экран под собой; вложенную карточку в back разворачивает до него', () => {
    const { result } = renderHook(() => ({ route: useRoute(), navigate: useNavigate() }), {
      wrapper: wrapper(),
    })
    act(() =>
      result.current.navigate({
        screen: 'portal',
        portal: 'ПТ-420-2',
        back: {
          screen: 'portal',
          portal: 'ПТ-420-1',
          back: { screen: 'world', world: 'Пепельные Топи' },
        },
      }),
    )
    expect(result.current.route).toEqual({
      screen: 'portal',
      portal: 'ПТ-420-2',
      back: { screen: 'world', world: 'Пепельные Топи' },
    })

    act(() =>
      result.current.navigate({
        screen: 'portal',
        portal: 'ПТ-420-2',
        back: { screen: 'portal', portal: 'ПТ-420-1' },
      }),
    )
    expect(result.current.route).toEqual({
      screen: 'portal',
      portal: 'ПТ-420-2',
      back: { screen: 'hall' },
    })
  })

  it('baseRoute: без back под карточкой зал, у остальных экранов — он сам', () => {
    expect(baseRoute({ screen: 'portal', portal: 'ПТ-420-1' })).toEqual({ screen: 'hall' })
    expect(baseRoute({ screen: 'atlas' })).toEqual({ screen: 'atlas' })
    expect(
      baseRoute({ screen: 'portal', portal: 'ПТ-420-1', back: { screen: 'journal' } }),
    ).toEqual({ screen: 'journal' })
  })

  it('navigate не меняет ссылку между перерисовками', () => {
    const { result, rerender } = renderHook(() => useNavigate(), { wrapper: wrapper() })
    const first = result.current
    act(() => first({ screen: 'atlas' }))
    rerender()
    expect(result.current).toBe(first)
  })

  it('вне провайдера — ошибка', () => {
    expect(() => renderHook(() => useRoute())).toThrow('useRoute: нет NavigationProvider')
    expect(() => renderHook(() => useNavigate())).toThrow('useNavigate: нет NavigationProvider')
  })
})
