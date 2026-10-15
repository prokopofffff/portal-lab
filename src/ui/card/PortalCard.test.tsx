import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Portal } from '../../domain'
import { labWith, logEntry, portal, world } from '../../test/labFixtures'
import { cardValues, portalCard, type PortalCardModel } from './cardModel'
import { PortalCard, type CardDelta } from './PortalCard'

const TOPI = 'Пепельные Топи'
const BEZ = 'Багровая Бездна'
const MAYAK = 'Забытый Маяк'
const SAD = 'Янтарный Сад'
const worlds = {
  [TOPI]: world(TOPI, 'ПТ-420', { creatures: 9, studied: 3 }),
  [BEZ]: world(BEZ, 'ББ-310', { creatures: 12, studied: 0 }),
  [MAYAK]: world(MAYAK, 'ЗМ-517', { creatures: 5, studied: 1 }),
  [SAD]: world(SAD, 'ЯС-179', { creatures: 7, studied: 7 }),
}

const critical = portal('ПТ-420-1', TOPI, {
  energy: 82,
  stability: 14,
  timeLeft: 8,
  observers: 2,
  studyProgress: 12.4,
})
const sibling = portal('ПТ-420-2', TOPI, { arch: 1, energy: 40, stability: 70, timeLeft: 200 })
const high = portal('ББ-310-1', BEZ, { arch: 2, energy: 91, stability: 35, timeLeft: 46 })
const collapsed = portal('ЗМ-517-1', MAYAK, {
  arch: 3,
  status: 'collapsed',
  energy: 77,
  stability: 0,
  timeLeft: 0,
})
const closed = portal('ЯС-179-2', SAD, {
  arch: 4,
  status: 'closed',
  energy: 28,
  stability: 81,
  timeLeft: 140,
})

function model(portals: Portal[], name: string, log = labWith({ worlds }).log): PortalCardModel {
  const m = portalCard(labWith({ worlds, portals, log }), name)
  expect(m).not.toBeNull()
  return m!
}

function renderCard(m: PortalCardModel, extra: { delta?: CardDelta; headingId?: string } = {}) {
  const onAction = vi.fn()
  const onOpenWorld = vi.fn()
  const onOpenPortal = vi.fn()
  const result = render(
    <PortalCard
      model={m}
      onAction={onAction}
      onOpenWorld={onOpenWorld}
      onOpenPortal={onOpenPortal}
      {...extra}
    />,
  )
  return { ...result, onAction, onOpenWorld, onOpenPortal }
}

// Рекомендованной способности читалка добавляет к имени «(рекомендуется)»
const ability = (name: string) =>
  screen.getByRole('button', { name: (n) => n === name || n === `${name} (рекомендуется)` })

describe('PortalCard: критический портал', () => {
  it('имя — заголовок h2 с переданным id, мир — кнопка-ссылка', async () => {
    const { onOpenWorld } = renderCard(model([critical, sibling], 'ПТ-420-1'), {
      headingId: 'card-title',
    })
    const heading = screen.getByRole('heading', { level: 2, name: 'ПТ-420-1' })
    expect(heading).toHaveAttribute('id', 'card-title')
    await userEvent.click(screen.getByRole('button', { name: TOPI }))
    expect(onOpenWorld).toHaveBeenCalledWith(TOPI)
  })

  it('статус, риск, разбор с итогом и печать жёсткого правила', () => {
    const m = model([critical, sibling], 'ПТ-420-1')
    const { container } = renderCard(m)
    expect(container.firstElementChild).toHaveAttribute('data-level', 'critical')
    expect(screen.getByText('ОТКРЫТ')).toBeInTheDocument()
    expect(screen.getByText(`Критический · ${m.risk.score}`)).toBeInTheDocument()
    for (const part of m.parts) expect(screen.getByText(part.label)).toBeInTheDocument()
    expect(screen.getByText('итого')).toBeInTheDocument()
    // Строка жёсткого правила — только текст правила, без подписи «ПЕЧАТЬ» из канваса (lab-ci6)
    expect(screen.getByText('время ≤ 10 → критический')).toBeInTheDocument()
    expect(screen.queryByText('ПЕЧАТЬ')).toBeNull()
  })

  it('метрики: подписи, полоски и значения', () => {
    renderCard(model([critical, sibling], 'ПТ-420-1'))
    expect(screen.getByRole('meter', { name: 'Энергия' })).toHaveAttribute('aria-valuenow', '82')
    expect(screen.getByText('82')).toBeInTheDocument()
    expect(screen.getByText('14 %')).toBeInTheDocument()
    expect(screen.getByText('8 мин')).toBeInTheDocument()
    expect(screen.queryByText(/^было/)).toBeNull()
  })

  it('изучение: счёт, изучаемое существо, наблюдатели на месте, ссылка на другой портал', async () => {
    const { onOpenPortal } = renderCard(model([critical, sibling], 'ПТ-420-1'))
    expect(screen.getByText('3 из 9')).toBeInTheDocument()
    expect(screen.getByText('Изучается существо №4')).toBeInTheDocument()
    expect(screen.getByText('62 %')).toBeInTheDocument()
    expect(screen.getAllByTestId('slot-on')).toHaveLength(2)
    expect(screen.getAllByTestId('slot-free')).toHaveLength(1)
    expect(screen.getByText('наблюдателей: 2')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'ещё 1 открытый портал в этот мир: ПТ-420-2' }),
    )
    expect(onOpenPortal).toHaveBeenCalledWith('ПТ-420-2')
  })

  it('совет и шесть способностей; рекомендованная отмечена', () => {
    const m = model([critical, sibling], 'ПТ-420-1')
    renderCard(m)
    expect(screen.getByRole('heading', { name: 'СОВЕТ СМОТРИТЕЛЮ' })).toBeInTheDocument()
    expect(screen.getByText(m.advice!.label, { selector: 'b' })).toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'Способности' })
    expect(within(group).getAllByRole('button')).toHaveLength(6)
    const recommended = ability('Отозвать наблюдателей')
    expect(recommended).toHaveAttribute('data-recommended', 'true')
    expect(recommended).toHaveAccessibleName('Отозвать наблюдателей (рекомендуется)')
    // Остальные — без приписки
    expect(ability('Стабилизировать')).toHaveAccessibleName('Стабилизировать')
  })

  it('несколько других порталов в мир — по ссылке на каждый', async () => {
    const third = portal('ПТ-420-3', TOPI, { arch: 5 })
    const { onOpenPortal } = renderCard(model([critical, sibling, third], 'ПТ-420-1'))
    expect(screen.getByText(/ещё 2 открытых портала в этот мир:/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'ПТ-420-3' }))
    expect(onOpenPortal).toHaveBeenCalledWith('ПТ-420-3')
    expect(screen.getByRole('button', { name: 'ПТ-420-2' })).toBeInTheDocument()
  })

  it('без наблюдателей — «наблюдателей нет», без соседей — без ссылки', () => {
    renderCard(model([high], 'ББ-310-1'))
    expect(screen.getByText('наблюдателей нет')).toBeInTheDocument()
    expect(screen.queryByText(/открытый портал в этот мир/)).toBeNull()
  })
})

describe('PortalCard: недоступные способности', () => {
  it('приглушены через aria-disabled, без disabled, и клик всё равно отдаёт команду', async () => {
    const m = model([critical, sibling], 'ПТ-420-1')
    const send = m.abilities.find((a) => a.command === 'sendObserver')!
    expect(send.available).toBe(false)
    const { onAction } = renderCard(m)
    const button = ability('Отправить наблюдателя')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()
    expect(button).toHaveStyle({ opacity: '0.5' })
    await userEvent.click(button)
    expect(onAction).toHaveBeenCalledWith({ type: 'sendObserver', portal: 'ПТ-420-1' })
  })

  it('доступная способность без aria-disabled отдаёт свою команду', async () => {
    const { onAction } = renderCard(model([critical, sibling], 'ПТ-420-1'))
    const button = ability('Отозвать наблюдателей')
    expect(button).not.toHaveAttribute('aria-disabled')
    await userEvent.click(button)
    expect(onAction).toHaveBeenCalledWith({ type: 'recallObservers', portal: 'ПТ-420-1' })
  })

  it('причина — подсказка, связанная aria-describedby; видна при фокусе с клавиатуры', async () => {
    const m = model([critical, sibling], 'ПТ-420-1')
    const reason = m.abilities.find((a) => a.command === 'sendObserver')!.reason!
    renderCard(m)
    const button = ability('Отправить наблюдателя')
    expect(button).toHaveAccessibleDescription(reason)
    const tip = document.getElementById(button.getAttribute('aria-describedby')!)!
    expect(tip).toHaveAttribute('role', 'tooltip')
    expect(tip).not.toBeVisible()

    const user = userEvent.setup()
    // Не больше 20 Tab: регрессия должна падать, а не зависать
    for (let i = 0; i < 20 && document.activeElement !== button; i++) await user.tab()
    expect(button).toHaveFocus()
    expect(tip).toBeVisible()
    expect(tip).toHaveTextContent(reason)

    await user.keyboard('{Escape}')
    expect(tip).not.toBeVisible()
    await user.tab()
    expect(tip).not.toBeVisible()
  })

  it('подсказка видна при наведении и прячется, когда курсор уходит', async () => {
    renderCard(model([critical, sibling], 'ПТ-420-1'))
    const button = ability('Отправить наблюдателя')
    const tip = document.getElementById(button.getAttribute('aria-describedby')!)!
    await userEvent.hover(button)
    expect(tip).toBeVisible()
    await userEvent.unhover(button)
    expect(tip).not.toBeVisible()
  })

  it('на подсказку от наведения можно навести курсор — она не пропадает', async () => {
    renderCard(model([critical, sibling], 'ПТ-420-1'))
    const button = ability('Отправить наблюдателя')
    const tip = document.getElementById(button.getAttribute('aria-describedby')!)!
    await userEvent.hover(button)
    expect(tip).toHaveStyle({ pointerEvents: 'auto' })
    await userEvent.hover(tip)
    expect(tip).toBeVisible()
    await userEvent.unhover(tip)
    expect(tip).not.toBeVisible()
  })

  it('подсказка от одного фокуса пропускает клик к соседней кнопке', async () => {
    renderCard(model([critical, sibling], 'ПТ-420-1'))
    const button = ability('Отправить наблюдателя')
    const tip = document.getElementById(button.getAttribute('aria-describedby')!)!
    act(() => button.focus())
    expect(tip).toBeVisible()
    expect(tip).toHaveStyle({ pointerEvents: 'none' })
  })

  it('спрятанная по Esc подсказка не возвращается, пока остаётся фокус', async () => {
    renderCard(model([critical, sibling], 'ПТ-420-1'))
    const button = ability('Отправить наблюдателя')
    const tip = document.getElementById(button.getAttribute('aria-describedby')!)!
    act(() => button.focus())
    await userEvent.hover(button)
    await userEvent.keyboard('{Escape}')
    expect(tip).not.toBeVisible()
    await userEvent.unhover(button)
    expect(tip).not.toBeVisible()
    act(() => button.blur())
    act(() => button.focus())
    expect(tip).toBeVisible()
  })

  it('у доступной способности подсказки нет', () => {
    renderCard(model([critical, sibling], 'ПТ-420-1'))
    expect(ability('Отозвать наблюдателей')).not.toHaveAttribute('aria-describedby')
  })
})

describe('PortalCard: перезарядка стабилизации', () => {
  it('кольцо с долей прошедшего и минутами до конца, кнопка приглушена', async () => {
    const cooling = { ...high, cooldown: 12 }
    const m = model([cooling], 'ББ-310-1')
    const stab = m.abilities.find((a) => a.command === 'stabilize')!
    expect(stab.cooldown).toEqual({ left: 12, elapsed: 0.6 })
    const { onAction } = renderCard(m)
    const button = ability('Стабилизировать')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription(stab.reason!)
    const ring = within(button).getByTestId('cooldown')
    expect(ring).toHaveTextContent('12')
    expect(ring.style.background).toContain('conic-gradient')
    expect(ring.style.background).toContain('0 60%')
    await userEvent.click(button)
    expect(onAction).toHaveBeenCalledWith({ type: 'stabilize', portal: 'ББ-310-1' })
  })

  it('без перезарядки кольца нет', () => {
    renderCard(model([high], 'ББ-310-1'))
    expect(screen.queryByTestId('cooldown')).toBeNull()
  })
})

describe('PortalCard: пометка «под вопросом»', () => {
  it('записка с заголовком и текстом пометки', () => {
    const note = 'Проверить, почему энергия растёт при низкой стабильности.'
    renderCard(model([{ ...high, questioned: { note } }], 'ББ-310-1'))
    expect(screen.getByText('ПОД ВОПРОСОМ')).toBeInTheDocument()
    expect(screen.getByText(note)).toBeInTheDocument()
  })

  it('пустая пометка — только заголовок записки; без пометки записки нет', () => {
    const { unmount } = renderCard(model([{ ...high, questioned: { note: '' } }], 'ББ-310-1'))
    expect(screen.getByText('ПОД ВОПРОСОМ')).toBeInTheDocument()
    unmount()
    renderCard(model([high], 'ББ-310-1'))
    expect(screen.queryByText('ПОД ВОПРОСОМ')).toBeNull()
  })
})

describe('PortalCard: архив', () => {
  it('схлопнувшийся: штамп, последний риск, итог архива, без совета и способностей, выцвел', () => {
    const m = model([collapsed], 'ЗМ-517-1')
    const { container } = renderCard(m)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('data-level', 'archived')
    expect(root.style.filter).toBe('grayscale(.85) sepia(.3) brightness(.82)')
    // Слово статуса — и на плашке, и на штампе
    expect(screen.getAllByText('СХЛОПНУЛСЯ')).toHaveLength(2)
    expect(screen.getByText(m.lastRisk!)).toBeInTheDocument()
    expect(screen.getByText(m.archive!)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Способности' })).toBeNull()
    expect(screen.queryByText('СОВЕТ СМОТРИТЕЛЮ')).toBeNull()
    expect(screen.queryByText('На месте')).toBeNull()
    expect(screen.queryByText(/→ критический$/)).toBeNull()
    expect(screen.getByRole('img', { name: 'Портал погас' })).toBeInTheDocument()
  })

  it('закрытый с изученным миром: существа на золотой рамке, без изучаемого существа', () => {
    renderCard(model([closed], 'ЯС-179-2'))
    expect(screen.getAllByText('ЗАКРЫТ')).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'Изучено 7 из 7' })).toHaveAttribute('data-full', 'true')
    expect(screen.queryByText(/Изучается существо/)).toBeNull()
  })

  it('у открытого портала штампа и итога архива нет', () => {
    const { container } = renderCard(model([high], 'ББ-310-1'))
    expect(screen.getAllByText('ОТКРЫТ')).toHaveLength(1)
    expect((container.firstElementChild as HTMLElement).style.filter).toBe('none')
  })
})

describe('PortalCard: «было — стало» после команды', () => {
  const after = { ...high, energy: 81, stability: 60, timeLeft: 66, cooldown: 12 }

  it('под изменившимися метриками — «было X, стало Y», у балла — чип снижения', () => {
    const before = model([high], 'ББ-310-1')
    const m = model([after], 'ББ-310-1')
    const drop = before.risk.score - m.risk.score
    expect(drop).toBeGreaterThan(0)
    renderCard(m, { delta: { before: cardValues(before), after: cardValues(m) } })
    expect(screen.getByText('было 91, стало 81')).toBeInTheDocument()
    expect(screen.getByText('было 35 %, стало 60 %')).toBeInTheDocument()
    expect(screen.getByText('было 46 мин, стало 66 мин')).toBeInTheDocument()
    expect(screen.getByText(`▼ −${drop}`)).toBeInTheDocument()
    expect(screen.getByText(`риск снизился на ${drop}`)).toBeInTheDocument()
  })

  it('неизменившиеся значения без строк и без чипа; рост балла — «▲ +N»', () => {
    const m = model([high], 'ББ-310-1')
    const same = {
      score: m.risk.score,
      energy: 91,
      stability: 35,
      timeLeft: 46,
    }
    const { unmount } = renderCard(m, { delta: { before: same, after: same } })
    expect(screen.queryByText(/^было/)).toBeNull()
    expect(screen.queryByText(/[▼▲]/)).toBeNull()
    unmount()
    renderCard(m, {
      delta: { before: { ...same, score: m.risk.score - 5, energy: 80 }, after: same },
    })
    expect(screen.getByText('▲ +5')).toBeInTheDocument()
    expect(screen.getByText('было 80, стало 91')).toBeInTheDocument()
    expect(screen.getAllByText(/^было/)).toHaveLength(1)
  })

  it('пара заморожена: «стало» и чип берутся из delta, а не из текущих значений', () => {
    // Карточка уже показывает другие (живые) значения, а строки — пару на момент команды
    const m = model([{ ...after, timeLeft: 50 }], 'ББ-310-1')
    renderCard(m, {
      delta: {
        before: { score: 60, energy: 91, stability: 35, timeLeft: 46 },
        after: { score: 42, energy: 81, stability: 60, timeLeft: 66 },
      },
    })
    expect(screen.getByText('было 46 мин, стало 66 мин')).toBeInTheDocument()
    expect(screen.getByText('50 мин')).toBeInTheDocument()
    expect(screen.getByText('▼ −18')).toBeInTheDocument()
  })
})

describe('PortalCard: история портала', () => {
  const log = [
    logEntry(120, 'Открыт портал ПТ-420-1 (Пепельные Топи)', {
      portal: 'ПТ-420-1',
      world: TOPI,
      kind: 'action',
    }),
    logEntry(137, 'Риск высокий → критический', { portal: 'ПТ-420-1', world: TOPI }),
    logEntry(143, 'Отказ: нельзя отправить наблюдателя', {
      portal: 'ПТ-420-1',
      world: TOPI,
      kind: 'rejection',
    }),
  ]

  it('записи с минутой; действие обычным, система курсивом, отказ цветом отказа', () => {
    renderCard(model([critical, sibling], 'ПТ-420-1', log))
    expect(screen.getByText('мин 120')).toBeInTheDocument()
    const action = screen.getByText('Открыт портал ПТ-420-1 (Пепельные Топи)')
    const system = screen.getByText('Риск высокий → критический')
    const rejection = screen.getByText('Отказ: нельзя отправить наблюдателя')
    expect(action.style.fontStyle).toBe('normal')
    expect(action.style.color).toBe('var(--c-text)')
    expect(system.style.fontStyle).toBe('italic')
    expect(system.style.color).toBe('var(--c-text-faint)')
    expect(rejection.style.color).toBe('var(--c-legend-rejection)')
  })

  it('свиток сворачивается и разворачивается', async () => {
    renderCard(model([critical, sibling], 'ПТ-420-1', log))
    // Имя постоянное: состояние объявляет только aria-expanded
    const toggle = screen.getByRole('button', { name: 'свиток истории' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('свиток развёрнут ▾')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAccessibleName('свиток истории')
    expect(toggle).toHaveTextContent('свиток свёрнут ▸')
    expect(screen.queryByText('мин 120')).not.toBeVisible()
    await userEvent.click(toggle)
    expect(screen.getByText('мин 120')).toBeVisible()
  })
})
