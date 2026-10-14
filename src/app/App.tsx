import { Dock } from '../ui/hud/Dock'
import { Hud } from '../ui/hud/Hud'
import { HallScreen } from '../ui/hall/HallScreen'
import { AtlasScreen } from '../ui/screens/AtlasScreen'
import { JournalScreen } from '../ui/screens/JournalScreen'
import { PortalStub } from '../ui/screens/PortalStub'
import { WorldScreen } from '../ui/screens/WorldScreen'
import { useDispatch, useSpeed } from './hooks'
import { NavigationProvider, useRoute } from './navigation'

// Экран по текущему маршруту
function Screen() {
  const route = useRoute()
  switch (route.screen) {
    case 'hall':
      return <HallScreen />
    case 'atlas':
      return <AtlasScreen />
    case 'world':
      return <WorldScreen world={route.world} />
    case 'portal':
      return <PortalStub portal={route.portal} />
    case 'journal':
      return <JournalScreen />
  }
}

// Текст диалога-свитка печати из канваса 15-dialogs
const SEAL_QUESTION =
  'Запечатать лабораторию? Все порталы, миры и записи книги будут стёрты. Вернуть их не получится.'

// HUD сверху, экран посередине, док снизу; на паузе корень замораживает спрайты
function Shell() {
  const [speed] = useSpeed()
  const dispatch = useDispatch()
  // Подтверждение печати (spec §5, §9): window.confirm до диалога-свитка lab-9dr.7
  const seal = () => {
    if (window.confirm(SEAL_QUESTION)) dispatch({ type: 'sealLab' })
  }
  return (
    <div
      className={speed === 0 ? 'is-paused' : undefined}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <Hud />
      <Screen />
      <Dock onSeal={seal} />
    </div>
  )
}

export function App() {
  return (
    <NavigationProvider>
      <Shell />
    </NavigationProvider>
  )
}
