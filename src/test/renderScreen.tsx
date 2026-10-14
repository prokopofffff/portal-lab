// Рендер экрана под настоящими провайдерами; текущий маршрут читается из <output>
/* oxlint-disable react/only-export-components */
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { LabStoreProvider } from '../app/hooks'
import { NavigationProvider, useRoute, type Route } from '../app/navigation'
import type { LabStore } from '../app/store'

function RouteProbe() {
  return <output data-testid="route">{JSON.stringify(useRoute())}</output>
}

export function renderScreen(ui: ReactNode, store: LabStore, initialRoute?: Route) {
  const result = render(
    <LabStoreProvider store={store}>
      <NavigationProvider initialRoute={initialRoute}>
        {ui}
        <RouteProbe />
      </NavigationProvider>
    </LabStoreProvider>,
  )
  const route = () => JSON.parse(result.getByTestId('route').textContent ?? 'null') as Route
  return { ...result, route }
}
