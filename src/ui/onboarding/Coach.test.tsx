import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import { ONBOARDING_KEY, OnboardingProvider } from '../../app/onboarding'
import { createLabStore } from '../../app/store'

function setup(offer = true) {
  const items = new Map<string, string>()
  const storage = {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
  const store = createLabStore({ storage, seed: 1, now: () => 0 })
  render(
    <OnboardingProvider store={store} storage={storage} now={() => 0} offer={offer}>
      <App />
    </OnboardingProvider>,
  )
  return { store, storage }
}

const coach = () => screen.getByRole('complementary', { name: 'Обучение' })
const stepOf = () => within(coach()).getByText(/^ОБУЧЕНИЕ/).textContent
const ability = (name: string) =>
  within(screen.getByRole('group', { name: 'Способности' })).getByRole('button', {
    name: new RegExp(`^${name}`),
  })

afterEach(() => vi.restoreAllMocks())

describe('приглашение', () => {
  it('«Пропустить» закрывает свиток и ставит флаг', async () => {
    const { storage } = setup()
    expect(screen.getByText('ДОБРО ПОЖАЛОВАТЬ, СМОТРИТЕЛЬ')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить' }))
    expect(screen.queryByText('ДОБРО ПОЖАЛОВАТЬ, СМОТРИТЕЛЬ')).not.toBeInTheDocument()
    expect(storage.items.get(ONBOARDING_KEY)).toBe('1')
    expect(screen.queryByRole('complementary', { name: 'Обучение' })).not.toBeInTheDocument()
  })

  it('без приглашения обучение запускается кнопкой в доке', async () => {
    setup(false)
    expect(screen.queryByText('ДОБРО ПОЖАЛОВАТЬ, СМОТРИТЕЛЬ')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Обучение' }))
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 1 / 13')
    // Пока идёт обучение, кнопки в доке нет
    expect(screen.queryByRole('button', { name: 'Обучение' })).not.toBeInTheDocument()
  })
})

describe('обучение', () => {
  it('полный путь: портал, наблюдатель, пометка, стабилизация, отказ, отзыв, закрытие, разделы', async () => {
    const { store } = setup()
    store.setSpeed(5)
    await userEvent.click(screen.getByRole('button', { name: 'Пройти обучение' }))
    expect(store.getState().speed).toBe(0)
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 1 / 13')
    expect(coach()).toHaveTextContent('Кликните по пустой арке')

    await userEvent.click(screen.getByRole('button', { name: 'Открыть портал в арке 1' }))
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 2 / 13')
    await userEvent.click(screen.getByRole('button', { name: 'Открыть карточку портала ЗК-005-1' }))
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 3 / 13')

    await userEvent.click(ability('Отправить наблюдателя'))
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 4 / 13')
    await userEvent.click(ability('Под вопросом'))
    await userEvent.click(screen.getByRole('button', { name: 'Пометить' }))
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 5 / 13')
    await userEvent.click(ability('Стабилизировать'))
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 6 / 13')

    await userEvent.click(ability('Закрыть'))
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 7 / 13')
    expect(coach()).toHaveTextContent(/^.*Отказ: портал нельзя закрыть/)
    await userEvent.click(ability('Отозвать наблюдателей'))
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 8 / 13')
    await userEvent.click(ability('Закрыть'))
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть всё равно' }))
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 9 / 13')

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть карточку' }))
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 10 / 13')
    await userEvent.click(screen.getByRole('link', { name: 'Атлас миров' }))
    await userEvent.click(screen.getByRole('link', { name: 'Книга журнала' }))
    await userEvent.click(screen.getByRole('link', { name: 'AI Worklog' }))
    expect(stepOf()).toBe('ОБУЧЕНИЕ · 13 / 13')

    await userEvent.click(within(coach()).getByRole('button', { name: 'В лабораторию' }))
    expect(screen.queryByRole('complementary', { name: 'Обучение' })).not.toBeInTheDocument()
    // Своя лаборатория: снова зал, порталов нет, скорость прежняя
    expect(screen.getAllByRole('button', { name: /^Открыть портал в арке/ })).toHaveLength(12)
    expect(store.getState().lab.portals).toHaveLength(0)
    expect(store.getState().speed).toBe(5)
  })

  it('«Выйти из обучения» возвращает в свою лабораторию', async () => {
    const { storage } = setup(false)
    await userEvent.click(screen.getByRole('button', { name: 'Обучение' }))
    await userEvent.click(screen.getByRole('button', { name: 'Открыть портал в арке 1' }))
    await userEvent.click(within(coach()).getByRole('button', { name: 'Выйти из обучения' }))
    expect(screen.queryByRole('complementary', { name: 'Обучение' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Открыть портал в арке/ })).toHaveLength(12)
    expect(storage.items.get(ONBOARDING_KEY)).toBe('1')
  })

  it('рамка обводит видимую цель, цель под карточкой не считается', async () => {
    // В jsdom у элементов нет размеров: даём их всем
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 100, 50, 40),
    )
    setup(false)
    await userEvent.click(screen.getByRole('button', { name: 'Обучение' }))
    expect(screen.getByTestId('tour-ring')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Открыть портал в арке 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Открыть карточку портала ЗК-005-1' }))
    // Карточку закрыли — подсказка ведёт обратно к порталу
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть карточку' }))
    expect(coach()).toHaveTextContent('Вернитесь в карточку портала')
    expect(screen.getByTestId('tour-ring')).toBeInTheDocument()
  })
})
