import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NotificationStack } from '../ui/banner/Banner'
import { PortalCardDialog } from '../ui/card/PortalCardDialog'
import { ScrollDialog } from '../ui/dialog/ScrollDialog'
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

// HUD сверху, экран посередине, док снизу; на паузе корень замораживает спрайты.
// Карточка портала и свиток печати — диалоги поверх всего: экран под ними виден сквозь затемнение,
// но инертен.
function Shell() {
  const [speed] = useSpeed()
  const dispatch = useDispatch()
  const route = useRoute()
  const card = route.screen === 'portal' ? route.portal : null
  useCardFocusReturn(card !== null)
  // Подтверждение печати (spec §5, §9): свиток из канваса 15-dialogs
  const [sealing, setSealing] = useState(false)
  const under = baseRoute(route)
  return (
    <div
      className={speed === 0 ? 'is-paused' : undefined}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <div inert={card !== null || sealing} style={{ display: 'contents' }}>
        <Hud />
        <Screen route={under} focus={card ?? undefined} />
        <Dock onSeal={() => setSealing(true)} />
      </div>
      {card !== null && <PortalCardDialog portal={card} back={under} />}
      {sealing && (
        <ScrollDialog
          rune="critical"
          tone="critical"
          title="ЗАПЕЧАТАТЬ ЛАБОРАТОРИЮ?"
          text="Все порталы, миры и записи книги будут стёрты. Вернуть их не получится."
          okLabel="Запечатать"
          okTone="danger"
          onOk={() => {
            setSealing(false)
            dispatch({ type: 'sealLab' })
          }}
          onCancel={() => setSealing(false)}
        />
      )}
      <NotificationStack cardOpen={card !== null} />
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
