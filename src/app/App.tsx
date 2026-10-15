import { Dock } from '../ui/hud/Dock'
import { Hud } from '../ui/hud/Hud'
import { HallScreen } from '../ui/hall/HallScreen'
import { AtlasScreen } from '../ui/screens/AtlasScreen'
import { JournalScreen } from '../ui/screens/JournalScreen'
import { PortalStub } from '../ui/screens/PortalStub'
import { WorldScreen } from '../ui/screens/WorldScreen'
import { useDispatch, useSpeed } from './hooks'
import { baseRoute, NavigationProvider, useRoute, type BaseRoute, type Route } from './navigation'

// Экран без карточки; focus — портал с рамкой фокуса в зале
function Base({ route, focus }: { route: BaseRoute; focus?: string }) {
  switch (route.screen) {
    case 'hall':
      return <HallScreen focus={focus} />
    case 'atlas':
      return <AtlasScreen />
    case 'world':
      return <WorldScreen world={route.world} />
    case 'journal':
      return <JournalScreen />
  }
}

// Экран по текущему маршруту; карточка портала лежит поверх экрана, из которого её открыли
function Screen() {
  const route = useRoute()
  if (route.screen !== 'portal') return <Base route={route} />
  return (
    <div style={{ position: 'relative', flex: '1 1 0', display: 'flex', flexDirection: 'column' }}>
      <Base route={baseRoute(route)} focus={route.portal} />
      {/* Заглушка до lab-9dr.6: просто слой поверх экрана */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <PortalStub portal={route.portal} />
      </div>
    </div>
  )
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

export function App({ initialRoute }: { initialRoute?: Route }) {
  return (
    <NavigationProvider initialRoute={initialRoute}>
      <Shell />
    </NavigationProvider>
  )
}
