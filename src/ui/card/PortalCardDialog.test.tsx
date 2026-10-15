import { act, fireEvent, screen, within } from '@testing-library/react'
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

  it('выделение, начатое в карточке и отпущенное на затемнении, не закрывает', () => {
    const { route } = renderDialog('ПТ-420-1')
    const overlay = screen.getByTestId('card-overlay')
    // Браузер отдаёт click общему предку нажатия и отпускания — здесь это затемнение
    fireEvent.mouseDown(screen.getByRole('heading', { name: 'ПТ-420-1' }))
    fireEvent.mouseUp(overlay)
    fireEvent.click(overlay)
    expect(route().screen).toBe('portal')

    // Следующее нажатие прямо на затемнении снова закрывает
    fireEvent.mouseDown(overlay)
    fireEvent.mouseUp(overlay)
    fireEvent.click(overlay)
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

    // Запись об отказе домен уже положил в журнал — история карточки показывает её
    const entry = store.getState().lab.log.at(-1)!
    expect(entry.kind).toBe('rejection')
    expect(entry.portal).toBe('ПТ-420-1')
    const { notifications } = store.getState()
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({ kind: 'refuse' })
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

  it('«было, стало» и чип заморожены: тики симуляции их не двигают', async () => {
    const { store } = renderDialog('ПТ-420-1')
    await userEvent.click(ability('Стабилизировать'))
    const lines = () => screen.getAllByText(/^было /).map((e) => e.textContent)
    const chip = () => screen.getByText(/^риск снизился на \d+$/).textContent
    const frozen = { lines: lines(), chip: chip() }
    expect(frozen.lines).toContain('было 8 мин, стало 28 мин')

    act(() => store.advance(25))
    // Живые значения ушли вперёд (время 28 → 3), а пара осталась той, что была после команды
    expect(screen.getByText('3 мин')).toBeInTheDocument()
    expect(lines()).toEqual(frozen.lines)
    expect(chip()).toBe(frozen.chip)
  })

  it('отказ стабилизации (кулдаун) убирает «было, стало»', async () => {
    const { store } = renderDialog('ПТ-420-1')
    await userEvent.click(ability('Стабилизировать'))
    expect(screen.getAllByText(/^было /).length).toBeGreaterThan(0)

    await userEvent.click(ability('Стабилизировать'))
    expect(store.getState().notifications.map((n) => n.kind)).toEqual(['refuse'])
    expect(store.getState().lab.log.at(-1)).toMatchObject({ kind: 'rejection', portal: 'ПТ-420-1' })
    expect(screen.queryByText(/^было /)).toBeNull()
  })
})

const scroll = () => screen.queryByRole('dialog', { name: /ЗАКРЫТЬ ПОСЛЕДНИЙ ПОРТАЛ\?|ПОМЕТИТЬ/ })
const scrollIn = () => within(scroll()!)

describe('PortalCardDialog: закрытие портала', () => {
  const TEXT =
    'Это последний открытый портал в Багровая Бездна. Не изучено 12 из 12 существ — продолжить изучение можно будет, только если портал в этот мир откроется снова.'

  it('последний в мир с неизученными: открывает свиток, без window.confirm; портал пока открыт', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { portalOf } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Закрыть'))
    const dialog = screen.getByRole('dialog', { name: 'ЗАКРЫТЬ ПОСЛЕДНИЙ ПОРТАЛ?' })
    expect(dialog).toHaveAccessibleDescription(TEXT)
    expect(within(dialog).getByRole('img', { name: 'Изучено 0 из 12' })).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
    expect(portalOf('ББ-310-1').status).toBe('open')
    expect(scrollIn().getByRole('button', { name: 'Отмена' })).toHaveFocus()
  })

  it('«Закрыть всё равно» закрывает портал и убирает свиток', async () => {
    const { portalOf } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Закрыть'))
    await userEvent.click(scrollIn().getByRole('button', { name: 'Закрыть всё равно' }))
    expect(portalOf('ББ-310-1').status).toBe('closed')
    expect(scroll()).toBeNull()
  })

  it('число изученных в существах свитка: изучено 3 из 9', async () => {
    const mixed = portal('ПТ-420-9', TOPI, { arch: 5 })
    const { portalOf } = renderDialog('ПТ-420-9', [mixed])
    await userEvent.click(ability('Закрыть'))
    expect(scrollIn().getByRole('img', { name: 'Изучено 3 из 9' })).toBeInTheDocument()
    expect(scroll()).toHaveAccessibleDescription(/Не изучено 6 из 9 существ/)
    expect(portalOf('ПТ-420-9').status).toBe('open')
  })

  it.each([
    ['«Отмена»', async () => userEvent.click(scrollIn().getByRole('button', { name: 'Отмена' }))],
    ['Esc', async () => userEvent.keyboard('{Escape}')],
    ['затемнение', async () => userEvent.click(screen.getByTestId('scroll-backdrop'))],
  ])('%s — cancelClose: портал открыт, отмена в истории, карточка осталась', async (_, cancel) => {
    const { portalOf, store, route } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Закрыть'))
    await cancel()
    expect(scroll()).toBeNull()
    expect(portalOf('ББ-310-1').status).toBe('open')
    expect(route().screen).toBe('portal')
    const { lab, notifications } = store.getState()
    expect(lab.log).toHaveLength(1)
    expect(lab.log[0]).toMatchObject({
      kind: 'action',
      portal: 'ББ-310-1',
      text: 'Закрытие ББ-310-1 (Багровая Бездна) отменено',
    })
    expect(notifications).toEqual([])
  })

  it('портал перестал быть открытым, пока свиток висел: отмена не шлёт cancelClose (нет ложного отказа)', async () => {
    const dying = { ...lonely, timeLeft: 1 }
    const { store, portalOf } = renderDialog('ББ-310-1', [critical, sibling, dying])
    // Портал последний в мир и неизученный: «Закрыть» спрашивает в свитке
    await userEvent.click(ability('Закрыть'))
    expect(scroll()).not.toBeNull()
    act(() => store.advance(3))
    expect(portalOf('ББ-310-1').status).toBe('collapsed')
    const logBefore = store.getState().lab.log.length

    await userEvent.click(scrollIn().getByRole('button', { name: 'Отмена' }))
    expect(scroll()).toBeNull()
    const { lab, notifications } = store.getState()
    expect(notifications.map((n) => n.kind)).not.toContain('refuse')
    expect(lab.log.slice(logBefore).some((e) => e.kind === 'rejection')).toBe(false)
  })

  it('«Закрыть» недоступно (наблюдатель на месте): без свитка, отказ домена, без отмены', async () => {
    const watched = { ...lonely, observers: 1 }
    const { portalOf, store } = renderDialog('ББ-310-1', [critical, sibling, watched])
    const close = ability('Закрыть')
    expect(close).toHaveAttribute('aria-disabled', 'true')

    await userEvent.click(close)
    expect(scroll()).toBeNull()
    expect(portalOf('ББ-310-1').status).toBe('open')
    expect(store.getState().notifications.map((n) => n.kind)).toEqual(['refuse'])
    const log = store.getState().lab.log
    expect(log).toHaveLength(1)
    expect(log[0]!.kind).toBe('rejection')
    expect(log[0]!.portal).toBe('ББ-310-1')
    expect(log.some((e) => e.text.includes('отменено'))).toBe(false)
    expect(screen.getByText(log[0]!.text)).toBeInTheDocument()
  })

  it('есть другой открытый портал в мир: закрывает без свитка', async () => {
    const { portalOf } = renderDialog('ПТ-420-2')
    await userEvent.click(ability('Закрыть'))
    expect(scroll()).toBeNull()
    expect(portalOf('ПТ-420-2').status).toBe('closed')
  })
})

describe('PortalCardDialog: свиток поверх карточки', () => {
  it('карточка инертна, Esc закрывает только свиток; фокус возвращается на «Закрыть»', async () => {
    const { route } = renderDialog('ББ-310-1')
    const close = ability('Закрыть')
    await userEvent.click(close)
    expect(screen.getByTestId('card-overlay')).toHaveAttribute('inert')

    await userEvent.keyboard('{Escape}')
    expect(scroll()).toBeNull()
    expect(route().screen).toBe('portal')
    expect(screen.getByTestId('card-overlay')).not.toHaveAttribute('inert')
    expect(close).toHaveFocus()

    // Следующий Esc закрывает уже карточку
    await userEvent.keyboard('{Escape}')
    expect(route()).toEqual(back)
  })

  it('клик по затемнению свитка не закрывает карточку', async () => {
    const { route } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Закрыть'))
    await userEvent.click(screen.getByTestId('scroll-backdrop'))
    expect(route().screen).toBe('portal')
  })

  it('симуляция идёт, пока свиток открыт; портал схлопнулся — фокус на карточке, а не на body', async () => {
    const dying = { ...lonely, timeLeft: 1 }
    const { store, portalOf } = renderDialog('ББ-310-1', [critical, sibling, dying])
    await userEvent.click(ability('Под вопросом'))
    expect(scroll()).not.toBeNull()

    act(() => store.advance(3))
    expect(portalOf('ББ-310-1').status).toBe('collapsed')
    expect(scroll()).not.toBeNull()

    await userEvent.keyboard('{Escape}')
    expect(scroll()).toBeNull()
    expect(screen.getByRole('dialog', { name: 'ББ-310-1' })).toHaveFocus()
  })

  it('портал перестал быть открытым до ОК: ОК шлёт команду, отказ домена — баннер', async () => {
    const dying = { ...lonely, timeLeft: 1 }
    const { store } = renderDialog('ББ-310-1', [critical, sibling, dying])
    await userEvent.click(ability('Под вопросом'))
    act(() => store.advance(3))

    await userEvent.click(scrollIn().getByRole('button', { name: 'Пометить' }))
    expect(scroll()).toBeNull()
    expect(store.getState().notifications.map((n) => n.kind)).toContain('refuse')
  })
})

describe('PortalCardDialog: фокус, когда способности исчезают', () => {
  it('после подтверждённого закрытия фокус на диалоге, а не на body', async () => {
    const { portalOf } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Закрыть'))
    await userEvent.click(scrollIn().getByRole('button', { name: 'Закрыть всё равно' }))
    expect(portalOf('ББ-310-1').status).toBe('closed')
    expect(screen.queryByRole('group', { name: 'Способности' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'ББ-310-1' })).toHaveFocus()
  })

  it('портал схлопнулся с фокусом на способности — фокус на диалоге', () => {
    const dying = { ...lonely, timeLeft: 1 }
    const { store, portalOf } = renderDialog('ББ-310-1', [critical, sibling, dying])
    act(() => ability('Под вопросом').focus())
    act(() => store.advance(3))
    expect(portalOf('ББ-310-1').status).toBe('collapsed')
    expect(screen.getByRole('dialog')).toHaveFocus()
  })
})

describe('PortalCardDialog: «Под вопросом»', () => {
  it('включение открывает свиток с заметкой, без window.prompt; фокус в поле', async () => {
    const prompt = vi.spyOn(window, 'prompt')
    const { portalOf } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Под вопросом'))
    const dialog = screen.getByRole('dialog', { name: 'ПОМЕТИТЬ «ПОД ВОПРОСОМ»' })
    expect(dialog).toHaveAccessibleDescription(
      'Портал получит значок и попадёт под фильтр «Под вопросом». Заметка приколется к его карте.',
    )
    expect(within(dialog).getByText(`ББ-310-1 · ${BEZ}`)).toBeInTheDocument()
    const field = within(dialog).getByRole('textbox', { name: 'Заметка (необязательно)' })
    expect(field).toHaveAttribute('rows', '3')
    expect(field).toHaveAttribute('placeholder', 'Что нужно проверить?')
    expect(field).toHaveFocus()
    // Контур фокуса даёт общее правило .scroll-dialog :focus-visible: инлайн outline его перебил бы
    expect(field).toHaveClass('scroll-note')
    expect(field.style.outline).toBe('')
    expect(prompt).not.toHaveBeenCalled()
    expect(portalOf('ББ-310-1').questioned).toBeNull()
  })

  it('«Пометить» ставит пометку с заметкой без пробелов по краям', async () => {
    const { portalOf } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Под вопросом'))
    await userEvent.type(screen.getByRole('textbox'), '  проверить энергию  ')
    await userEvent.click(scrollIn().getByRole('button', { name: 'Пометить' }))
    expect(portalOf('ББ-310-1').questioned).toEqual({ note: 'проверить энергию' })
    expect(scroll()).toBeNull()
    expect(ability('Под вопросом')).toHaveFocus()
  })

  it('Enter в поле — перенос строки, а не отправка', async () => {
    const { portalOf } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Под вопросом'))
    await userEvent.type(screen.getByRole('textbox'), 'раз{Enter}два')
    expect(screen.getByRole('textbox')).toHaveValue('раз\nдва')
    expect(scroll()).not.toBeNull()
    expect(portalOf('ББ-310-1').questioned).toBeNull()
  })

  it('без заметки пометка ставится с пустой', async () => {
    const { portalOf } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Под вопросом'))
    await userEvent.click(scrollIn().getByRole('button', { name: 'Пометить' }))
    expect(portalOf('ББ-310-1').questioned).toEqual({ note: '' })
  })

  it('отмена — команды нет, в истории пусто', async () => {
    const { portalOf, store } = renderDialog('ББ-310-1')
    await userEvent.click(ability('Под вопросом'))
    await userEvent.type(screen.getByRole('textbox'), 'забудем')
    await userEvent.click(scrollIn().getByRole('button', { name: 'Отмена' }))
    expect(scroll()).toBeNull()
    expect(portalOf('ББ-310-1').questioned).toBeNull()
    expect(store.getState().lab.log).toEqual([])
    expect(ability('Под вопросом')).toHaveFocus()
  })

  it('выключение снимает пометку без свитка', async () => {
    const marked = { ...lonely, questioned: { note: '' } }
    const { portalOf } = renderDialog('ББ-310-1', [critical, sibling, marked])
    await userEvent.click(ability('Под вопросом'))
    expect(scroll()).toBeNull()
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
