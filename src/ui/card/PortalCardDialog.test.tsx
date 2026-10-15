import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Route } from '../../app/navigation'
import type { Portal } from '../../domain'
import { labWith, portal, storeWithLab, world } from '../../test/labFixtures'
import { renderScreen } from '../../test/renderScreen'
import { PortalCardDialog } from './PortalCardDialog'

const TOPI = 'Пепельные Топи'
const BEZ = 'Багровая Бездна'
const worlds = {
  [TOPI]: world(TOPI, 'ПТ-420', { creatures: 9, studied: 3 }),
  [BEZ]: world(BEZ, 'ББ-310', { creatures: 12, studied: 0 }),
}

// Критический: наблюдателя отправить нельзя, стабилизировать можно
const critical = portal('ПТ-420-1', TOPI, { energy: 82, stability: 14, timeLeft: 8 })
const sibling = portal('ПТ-420-2', TOPI, { arch: 1 })
const lonely = portal('ББ-310-1', BEZ, { arch: 2 })

const back: Route = { screen: 'world', world: TOPI }

function renderDialog(name: string, portals: Portal[] = [critical, sibling, lonely]) {
  const store = storeWithLab(labWith({ worlds, portals }))
  const result = renderScreen(
    <PortalCardDialog portal={name} back={{ screen: 'world', world: TOPI }} />,
    store,
    { screen: 'portal', portal: name, back },
  )
  const portalOf = (n: string) => store.getState().lab.portals.find((p) => p.name === n)!
  return { ...result, store, portalOf }
}

const ability = (name: string) =>
  within(screen.getByRole('group', { name: 'Способности' })).getByRole('button', { name })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PortalCardDialog: диалог', () => {
  it('модальный диалог с именем по заголовку карточки; фокус внутри', () => {
    renderDialog('ПТ-420-1')
    const dialog = screen.getByRole('dialog', { name: 'ПТ-420-1' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveFocus()
  })

  it('Esc возвращает на экран back', async () => {
    const { route } = renderDialog('ПТ-420-1')
    await userEvent.keyboard('{Escape}')
    expect(route()).toEqual(back)
  })

  it('крестик возвращает на экран back', async () => {
    const { route } = renderDialog('ПТ-420-1')
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть карточку' }))
    expect(route()).toEqual(back)
  })

  it('клик по затемнению закрывает, клик по карточке — нет', async () => {
    const { route } = renderDialog('ПТ-420-1')
    await userEvent.click(screen.getByRole('heading', { name: 'ПТ-420-1' }))
    expect(route().screen).toBe('portal')

    await userEvent.click(screen.getByTestId('card-overlay'))
    expect(route()).toEqual(back)
  })

  it('Esc на недоступной способности сначала прячет подсказку, потом закрывает', async () => {
    const { route } = renderDialog('ПТ-420-1')
    const send = ability('Отправить наблюдателя')
    act(() => send.focus())
    expect(screen.getByRole('tooltip')).toBeVisible()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(route().screen).toBe('portal')

    await userEvent.keyboard('{Escape}')
    expect(route()).toEqual(back)
  })

  it('мир открывает страницу мира, другой портал — свою карточку с тем же back', async () => {
    const { route } = renderDialog('ПТ-420-1')
    await userEvent.click(screen.getByRole('button', { name: /ещё 1 открытый портал/ }))
    expect(route()).toEqual({ screen: 'portal', portal: 'ПТ-420-2', back })

    await userEvent.click(screen.getByRole('button', { name: TOPI }))
    expect(route()).toEqual({ screen: 'world', world: TOPI })
  })

  it('неизвестный портал: панель «не найден» с тем же закрытием', async () => {
    const { route } = renderDialog('ХХ-000-1')
    expect(screen.getByRole('dialog', { name: 'Портал ХХ-000-1 не найден' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(route()).toEqual(back)
  })

  it('карточка перечитывает store: тик меняет показанные метрики', () => {
    const { store } = renderDialog('ББ-310-1')
    expect(screen.getByText('наблюдателей нет')).toBeInTheDocument()
    act(() => {
      store.dispatch({ type: 'sendObserver', portal: 'ББ-310-1' })
    })
    expect(screen.getByText('наблюдателей: 1')).toBeInTheDocument()
  })
})

describe('PortalCardDialog: способности', () => {
  it('доступная способность отдаёт команду', async () => {
    const { portalOf } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Отправить наблюдателя'))
    expect(portalOf('ББ-310-1').observers).toBe(1)
  })

  it('недоступная отдаёт команду: отказ в store и в истории карточки', async () => {
    const { store } = renderDialog('ПТ-420-1')
    await userEvent.click(ability('Отправить наблюдателя'))

    const rejection = store.getState().rejection
    expect(rejection?.command).toEqual({ type: 'sendObserver', portal: 'ПТ-420-1' })
    // Запись об отказе домен уже положил в журнал — история карточки показывает её
    const entry = store.getState().lab.log.at(-1)!
    expect(entry.kind).toBe('rejection')
    expect(screen.getByText(entry.text)).toBeInTheDocument()
  })

  it('стабилизация: «было, стало» и снижение балла, пока не пришла другая команда', async () => {
    renderDialog('ПТ-420-1')
    await userEvent.click(ability('Стабилизировать'))
    expect(screen.getByText(/^было 14 %, стало/)).toBeInTheDocument()
    expect(screen.getByText(/^риск снизился на \d+$/)).toBeInTheDocument()

    await userEvent.click(ability('Отправить наблюдателя'))
    expect(screen.queryByText(/^было /)).toBeNull()
  })

  it('отказ стабилизации (кулдаун) убирает «было, стало»', async () => {
    const { store } = renderDialog('ПТ-420-1')
    await userEvent.click(ability('Стабилизировать'))
    expect(screen.getAllByText(/^было /).length).toBeGreaterThan(0)

    await userEvent.click(ability('Стабилизировать'))
    expect(store.getState().rejection?.command.type).toBe('stabilize')
    expect(screen.queryByText(/^было /)).toBeNull()
  })
})

describe('PortalCardDialog: закрытие портала', () => {
  const QUESTION =
    'Это последний открытый портал в Багровая Бездна. Не изучено 12 из 12 существ — продолжить изучение можно будет, только если портал в этот мир откроется снова'

  it('последний в мир с неизученными: спрашивает; OK — закрывает', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { portalOf } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Закрыть'))
    expect(confirm).toHaveBeenCalledWith(QUESTION)
    expect(portalOf('ББ-310-1').status).toBe('closed')
  })

  it('отмена — cancelClose: портал открыт, отмена в истории', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { portalOf, store } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Закрыть'))
    expect(portalOf('ББ-310-1').status).toBe('open')
    expect(store.getState().lab.log.at(-1)?.portal).toBe('ББ-310-1')
    expect(store.getState().lab.log.length).toBe(1)
  })

  it('есть другой открытый портал в мир: закрывает без вопроса', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { portalOf } = renderDialog('ПТ-420-2')
    await userEvent.click(ability('Закрыть'))
    expect(confirm).not.toHaveBeenCalled()
    expect(portalOf('ПТ-420-2').status).toBe('closed')
  })
})

describe('PortalCardDialog: «Под вопросом»', () => {
  it('включение спрашивает заметку и ставит пометку с ней', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('проверить энергию')
    const { portalOf } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Под вопросом'))
    expect(prompt).toHaveBeenCalledOnce()
    expect(prompt.mock.calls[0]![0]).toContain('ББ-310-1')
    expect(portalOf('ББ-310-1').questioned).toEqual({ note: 'проверить энергию' })
  })

  it('отмена заметки — команды нет', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    const { portalOf, store } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Под вопросом'))
    expect(portalOf('ББ-310-1').questioned).toBeNull()
    expect(store.getState().lab.log).toEqual([])
  })

  it('выключение снимает пометку без вопроса', async () => {
    const prompt = vi.spyOn(window, 'prompt')
    const marked = { ...lonely, questioned: { note: '' } }
    const { portalOf } = renderDialog('ББ-310-1', [critical, sibling, marked])
    await userEvent.click(ability('Под вопросом'))
    expect(prompt).not.toHaveBeenCalled()
    expect(portalOf('ББ-310-1').questioned).toBeNull()
  })
})

describe('PortalCardDialog: затемнение', () => {
  it('на всё окно и прокручивается, если карточка выше окна', () => {
    renderDialog('ПТ-420-1')
    const overlay = screen.getByTestId('card-overlay')
    expect(overlay.style.position).toBe('fixed')
    expect(overlay.style.inset).toBe('0px')
    expect(overlay.style.overflowY).toBe('auto')
    expect(overlay.style.background).toBe('var(--c-overlay)')
  })
})
