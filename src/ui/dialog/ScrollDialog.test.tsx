import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScrollDialog } from './ScrollDialog'

function renderScroll(props: Partial<Parameters<typeof ScrollDialog>[0]> = {}) {
  const onOk = vi.fn()
  const onCancel = vi.fn()
  const result = render(
    <ScrollDialog
      rune="critical"
      tone="critical"
      title="ЗАПЕЧАТАТЬ ЛАБОРАТОРИЮ?"
      text="Все порталы сотрутся."
      okLabel="Запечатать"
      okTone="danger"
      onOk={onOk}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onOk, onCancel, ...result }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ScrollDialog: разметка', () => {
  it('модальный диалог: имя по заголовку, описание по тексту', () => {
    renderScroll()
    const dialog = screen.getByRole('dialog', { name: 'ЗАПЕЧАТАТЬ ЛАБОРАТОРИЮ?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Все порталы сотрутся.')
  })

  it('выводится в document.body, а не внутрь родителя', () => {
    const { container } = renderScroll()
    expect(container).toBeEmptyDOMElement()
    expect(document.body).toContainElement(screen.getByRole('dialog'))
  })

  it('подзаголовок и вложенное содержимое — между текстом и кнопками', () => {
    renderScroll({ sub: 'ББ-310-1 · Багровая Бездна', children: <p>Вложенное</p> })
    expect(screen.getByText('ББ-310-1 · Багровая Бездна')).toBeInTheDocument()
    expect(screen.getByText('Вложенное')).toBeInTheDocument()
  })

  it('руна уровня риска перед заголовком', () => {
    renderScroll({ rune: 'high', tone: 'high' })
    expect(screen.getByRole('img', { name: 'Высокий риск' })).toBeInTheDocument()
  })
})

describe('ScrollDialog: кнопки и фон', () => {
  it('ОК зовёт onOk, Отмена — onCancel', async () => {
    const { onOk, onCancel } = renderScroll()
    await userEvent.click(screen.getByRole('button', { name: 'Запечатать' }))
    expect(onOk).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('клик по затемнению — отмена, клик по самому свитку — нет', async () => {
    const { onCancel } = renderScroll()
    await userEvent.click(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()
    await userEvent.click(screen.getByTestId('scroll-backdrop'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('выделение, начатое внутри свитка и отпущенное на затемнении, не отменяет', () => {
    const { onCancel } = renderScroll({ children: <textarea aria-label="Заметка" /> })
    const backdrop = screen.getByTestId('scroll-backdrop')
    // Браузер отдаёт click общему предку нажатия и отпускания — здесь это затемнение
    fireEvent.mouseDown(screen.getByRole('textbox', { name: 'Заметка' }))
    fireEvent.mouseUp(backdrop)
    fireEvent.click(backdrop)
    expect(onCancel).not.toHaveBeenCalled()

    // Нажатие на затемнении, отпущенное на свитке, тоже не отменяет
    fireEvent.mouseDown(backdrop)
    fireEvent.mouseUp(screen.getByRole('dialog'))
    fireEvent.click(backdrop)
    expect(onCancel).not.toHaveBeenCalled()

    // Следующее нажатие прямо на затемнении снова отменяет
    fireEvent.mouseDown(backdrop)
    fireEvent.mouseUp(backdrop)
    fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('ScrollDialog: клавиатура и фокус', () => {
  it('начальный фокус — на «Отмена» (безопасный выбор)', () => {
    renderScroll()
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()
  })

  it('начальный фокус — на элементе из initialFocus', () => {
    const ref = createRef<HTMLTextAreaElement>()
    renderScroll({ initialFocus: ref, children: <textarea ref={ref} aria-label="Заметка" /> })
    expect(screen.getByRole('textbox', { name: 'Заметка' })).toHaveFocus()
  })

  it('Tab и Shift+Tab ходят по кругу внутри свитка, не выходя на страницу', async () => {
    render(
      <>
        <button>Снаружи до</button>
        <button>Снаружи после</button>
      </>,
    )
    renderScroll()
    const ok = screen.getByRole('button', { name: 'Запечатать' })
    const cancel = screen.getByRole('button', { name: 'Отмена' })
    expect(cancel).toHaveFocus()
    await userEvent.tab()
    expect(ok).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(cancel).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(ok).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(cancel).toHaveFocus()
  })

  it('в круг входят и поля из вложенного содержимого', async () => {
    renderScroll({ children: <textarea aria-label="Заметка" /> })
    const field = screen.getByRole('textbox', { name: 'Заметка' })
    const cancel = screen.getByRole('button', { name: 'Отмена' })
    await userEvent.tab() // с «Отмена» (последней) вперёд — круг замкнулся на поле
    expect(field).toHaveFocus()
    await userEvent.tab({ shift: true }) // с поля (первого) назад — на «Отмена»
    expect(cancel).toHaveFocus()
  })

  it('фокус вне свитка (баннер над ним, body): Tab и Shift+Tab возвращают его в свиток', async () => {
    renderScroll()
    // Кнопки после свитка в порядке обхода: без ловушки Tab с первой ушёл бы на вторую
    render(
      <>
        <button>Баннер</button>
        <button>Закрыть баннер</button>
      </>,
    )
    const ok = screen.getByRole('button', { name: 'Запечатать' })
    const cancel = screen.getByRole('button', { name: 'Отмена' })

    screen.getByRole('button', { name: 'Баннер' }).focus()
    await userEvent.tab()
    expect(ok).toHaveFocus()

    screen.getByRole('button', { name: 'Закрыть баннер' }).focus()
    await userEvent.tab({ shift: true })
    expect(cancel).toHaveFocus()

    ;(document.activeElement as HTMLElement).blur()
    await userEvent.tab()
    expect(ok).toHaveFocus()
  })

  it('Esc — отмена', async () => {
    const { onCancel, onOk } = renderScroll()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onOk).not.toHaveBeenCalled()
  })

  it('Esc не доходит до слушателя на document: карточка под свитком не закроется', async () => {
    const onDocument = vi.fn()
    // как у карточки портала: слушатель на document, пропускающий уже потраченный Esc
    const closeCard = vi.fn()
    const card = (e: KeyboardEvent) => {
      onDocument(e.defaultPrevented)
      if (e.key === 'Escape' && !e.defaultPrevented) closeCard()
    }
    document.addEventListener('keydown', card)
    const { onCancel } = renderScroll()
    await userEvent.keyboard('{Escape}')
    document.removeEventListener('keydown', card)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(closeCard).not.toHaveBeenCalled()
    // если событие всё же дошло — оно помечено как потраченное
    for (const [prevented] of onDocument.mock.calls) expect(prevented).toBe(true)
  })

  it('Esc работает, даже если фокус ушёл на body', async () => {
    const { onCancel } = renderScroll()
    ;(document.activeElement as HTMLElement).blur()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('после закрытия фокус возвращается на открывший элемент', async () => {
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Открыть</button>
          {open && (
            <ScrollDialog
              rune="critical"
              tone="critical"
              title="Т"
              text="Текст"
              okLabel="Да"
              okTone="danger"
              onOk={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          )}
        </>
      )
    }
    render(<Host />)
    const opener = screen.getByRole('button', { name: 'Открыть' })
    await userEvent.click(opener)
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('если открывший элемент исчез, фокус не падает с ошибкой', async () => {
    function Host() {
      const [state, setState] = useState<'idle' | 'open' | 'gone'>('idle')
      return (
        <>
          {state === 'idle' && <button onClick={() => setState('open')}>Открыть</button>}
          {state === 'open' && (
            <ScrollDialog
              rune="critical"
              tone="critical"
              title="Т"
              text="Текст"
              okLabel="Да"
              okTone="mark"
              onOk={() => setState('gone')}
              onCancel={() => setState('gone')}
            />
          )}
        </>
      )
    }
    render(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }))
    await userEvent.click(screen.getByRole('button', { name: 'Да' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
