import { useEffect, useLayoutEffect, useRef } from 'react'
import { NotificationStack } from '../ui/banner/Banner'
import { PortalCardDialog } from '../ui/card/PortalCardDialog'
import { Dock } from '../ui/hud/Dock'
import { Hud } from '../ui/hud/Hud'
import { HallScreen } from '../ui/hall/HallScreen'
import { AtlasScreen } from '../ui/screens/AtlasScreen'
import { JournalScreen } from '../ui/screens/JournalScreen'
import { WorldScreen } from '../ui/screens/WorldScreen'
import { useDispatch, useSpeed } from './hooks'
import { baseRoute, NavigationProvider, useRoute, type BaseRoute, type Route } from './navigation'

// Экран без карточки; focus — портал с рамкой фокуса в зале
function Screen({ route, focus }: { route: BaseRoute; focus?: string }) {
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

// Фокус на основную область экрана, когда вернуть его некуда
function focusMain(): void {
  const main = document.querySelector('main')
  if (!main) return
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1')
  main.focus()
}

/**
 * Возврат фокуса после карточки: на то, что её открыло, если оно ещё на экране, иначе на основную
 * область. Открывший элемент запоминается в layout-эффекте — до того, как диалог заберёт фокус
 * в своём (обычном) эффекте; возвращается в обычном эффекте, когда инертность уже снята.
 */
function useCardFocusReturn(open: boolean): void {
  const opener = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(open)

  useLayoutEffect(() => {
    if (!open) return
    const active = document.activeElement
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null
  }, [open])

  useEffect(() => {
    if (open || !wasOpen.current) {
      wasOpen.current = open
      return
    }
    wasOpen.current = false
    const target = opener.current
    opener.current = null
    if (target?.isConnected) target.focus()
    else focusMain()
  }, [open])
}

// Текст диалога-свитка печати из канваса 15-dialogs
const SEAL_QUESTION =
  'Запечатать лабораторию? Все порталы, миры и записи книги будут стёрты. Вернуть их не получится.'

// HUD сверху, экран посередине, док снизу; на паузе корень замораживает спрайты.
// Карточка портала — диалог поверх всего: экран под ней виден сквозь затемнение, но инертен.
function Shell() {
  const [speed] = useSpeed()
  const dispatch = useDispatch()
  const route = useRoute()
  const card = route.screen === 'portal' ? route.portal : null
  useCardFocusReturn(card !== null)
  // Подтверждение печати (spec §5, §9): window.confirm до диалога-свитка lab-9dr.7
  const seal = () => {
    if (window.confirm(SEAL_QUESTION)) dispatch({ type: 'sealLab' })
  }
  const under = baseRoute(route)
  return (
    <div
      className={speed === 0 ? 'is-paused' : undefined}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <div inert={card !== null} style={{ display: 'contents' }}>
        <Hud />
        <Screen route={under} focus={card ?? undefined} />
        <Dock onSeal={seal} />
      </div>
      {card !== null && <PortalCardDialog portal={card} back={under} />}
      <NotificationStack />
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
