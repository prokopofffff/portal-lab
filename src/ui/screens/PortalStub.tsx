import { useLabSelector } from '../../app/hooks'
import { RouteLink } from './RouteLink'
import { ScreenFrame } from './ScreenFrame'

/** Временная заглушка карточки портала до lab-9dr.6: имя и ссылка назад в мир. */
export function PortalStub({ portal: portalName }: { portal: string }) {
  const portal = useLabSelector((state) => state.lab.portals.find((p) => p.name === portalName))

  return (
    <ScreenFrame>
      {portal ? (
        <>
          <h1 style={{ margin: 0, fontFamily: 'var(--f-pixel)', fontWeight: 400, fontSize: 22 }}>
            {portal.name}
          </h1>
          <p style={{ margin: 0, color: 'var(--c-cellar-label)' }}>
            Мир:{' '}
            <RouteLink
              to={{ screen: 'world', world: portal.world }}
              style={{ color: 'var(--c-cellar-title)' }}
            >
              {portal.world}
            </RouteLink>
          </p>
        </>
      ) : (
        <p style={{ margin: 0 }}>Портал {portalName} не найден</p>
      )}
    </ScreenFrame>
  )
}
