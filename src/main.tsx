import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { applyTheme } from './ui/theme/applyTheme'
import './ui/theme/global.css'

applyTheme(document.documentElement)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
