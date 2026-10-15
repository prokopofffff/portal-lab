import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { installTestMode, parseLaunch } from './app/launch'
import { OnboardingProvider, onboardingSeen } from './app/onboarding'
import { startSimulation } from './app/simulation'
import { createLabStore } from './app/store'
import { applyTheme } from './ui/theme/applyTheme'
import './ui/theme/global.css'

applyTheme(document.documentElement)

const launch = parseLaunch(location.search)
const store = createLabStore({
  storage: localStorage,
  seed: launch.seed ?? Date.now() >>> 0,
  now: Date.now,
})
if (launch.test) installTestMode(store, window)
const simulation = {
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  now: () => performance.now(),
  document,
}
startSimulation(store, simulation)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OnboardingProvider
      store={store}
      storage={localStorage}
      now={Date.now}
      // В тестовом режиме приглашение помешало бы сценариям; обучение — по кнопке в доке
      offer={!launch.test && !onboardingSeen(localStorage)}
      simulation={simulation}
    >
      <App />
    </OnboardingProvider>
  </StrictMode>,
)
