import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { LabStoreProvider } from './app/hooks'
import { startSimulation } from './app/simulation'
import { createLabStore } from './app/store'
import { applyTheme } from './ui/theme/applyTheme'
import './ui/theme/global.css'

applyTheme(document.documentElement)

const store = createLabStore({ storage: localStorage, seed: Date.now() >>> 0, now: Date.now })
startSimulation(store, {
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  now: () => performance.now(),
  document,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LabStoreProvider store={store}>
      <App />
    </LabStoreProvider>
  </StrictMode>,
)
