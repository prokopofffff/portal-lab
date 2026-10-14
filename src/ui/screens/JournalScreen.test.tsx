import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../../domain'
import { labWith, logEntry, storeWithLab, world } from '../../test/labFixtures'
import { renderScreen } from '../../test/renderScreen'
import { JournalScreen } from './JournalScreen'

const TOPI = 'Пепельные Топи'
const BEZDNA = 'Багровая Бездна'
const worlds = { [TOPI]: world(TOPI, 'ПТ-420'), [BEZDNA]: world(BEZDNA, 'ББ-310') }

// Запись №n: по виду, порталу и миру разные, чтобы фильтры было на чём проверять
function numbered(n: number): LogEntry {
  const kind = (['action', 'rejection', 'system'] as const)[n % 3]!
  const inTopi = n % 2 === 0
  return logEntry(n, `Запись ${n}`, {
    kind,
    portal: inTopi ? 'ПТ-420-1' : 'ББ-310-1',
    world: inTopi ? TOPI : BEZDNA,
  })
}

function log(count: number): LogEntry[] {
  return Array.from({ length: count }, (_, i) => numbered(i + 1))
}

function renderJournal(entries: LogEntry[]) {
  const store = storeWithLab(labWith({ worlds, log: entries }))
  return { store, ...renderScreen(<JournalScreen />, store, { screen: 'journal' }) }
}

// Тексты записей страницы по порядку
function texts(page: HTMLElement): string[] {
  return within(page)
    .queryAllByRole('listitem')
    .map((li) => li.lastElementChild?.textContent ?? '')
}

function numbers(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => `Запись ${from + i}`)
}

const left = (n: number) => screen.getByRole('list', { name: `Страница ${n}` })

async function pickFilter(ribbon: RegExp, option: string) {
  await userEvent.click(screen.getByRole('button', { name: ribbon }))
  await userEvent.click(screen.getByRole('button', { name: option }))
}

describe('Книга журнала (spec §8, §9)', () => {
  describe('пустая книга', () => {
    it('чистые страницы, счётчики и подсказка', () => {
      renderJournal([])

      expect(screen.getByRole('heading', { name: 'КНИГА ЖУРНАЛА' })).toBeInTheDocument()
      expect(screen.getByText('разворот 1 · записей: 0')).toBeInTheDocument()
      expect(
        screen.getByText('Страницы чисты. Первая запись появится, когда откроется первый портал.'),
      ).toBeInTheDocument()
      expect(screen.getByText('стр. 1')).toBeInTheDocument()
      expect(screen.getByText('стр. 2')).toBeInTheDocument()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    })

    it('листать некуда', () => {
      renderJournal([])

      expect(screen.getByRole('button', { name: 'Предыдущий разворот' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Следующий разворот' })).toBeDisabled()
    })
  })

  describe('запись', () => {
    it('время симуляции, реальное время HH:MM по местному времени и текст', () => {
      const realTime = new Date(2026, 9, 14, 13, 5).getTime()
      renderJournal([logEntry(24, 'Схлопнулся портал', { realTime, kind: 'system' })])

      const item = screen.getByRole('listitem')
      expect(item).toHaveTextContent('мин 24')
      expect(item).toHaveTextContent('13:05')
      expect(item.lastElementChild).toHaveTextContent('Схлопнулся портал')
    })

    it('вид записи: data-kind, значок и чернила из токенов', () => {
      renderJournal([
        logEntry(1, 'Открыт', { kind: 'action' }),
        logEntry(2, 'Отказ', { kind: 'rejection' }),
        logEntry(3, 'Система', { kind: 'system' }),
      ])

      const items = screen.getAllByRole('listitem')
      expect(items.map((li) => li.getAttribute('data-kind'))).toEqual([
        'action',
        'rejection',
        'system',
      ])
      expect(within(items[0]!).getByRole('img', { name: 'действие' })).toBeInTheDocument()
      expect(within(items[1]!).getByRole('img', { name: 'отказ' })).toBeInTheDocument()
      expect(within(items[2]!).getByRole('img', { name: 'система' })).toBeInTheDocument()
      expect(items[0]!.lastElementChild).toHaveStyle({ color: 'var(--c-ink-action)' })
      expect(items[1]!.lastElementChild).toHaveStyle({ color: 'var(--c-ink-rejection)' })
      expect(items[2]!.lastElementChild).toHaveStyle({ color: 'var(--c-ink-system)' })
    })
  })

  describe('страницы и разворот', () => {
    it('открывается на новейшем развороте; записи идут от старых к новым', () => {
      renderJournal(log(20))

      expect(screen.getByText('разворот 2 · записей: 20')).toBeInTheDocument()
      expect(screen.getByText('стр. 3')).toBeInTheDocument()
      expect(screen.getByText('стр. 4')).toBeInTheDocument()
      expect(texts(left(3))).toEqual(numbers(15, 20))
      expect(texts(left(4))).toEqual([])
    })

    it('на листе семь записей: левая страница заполняется первой', async () => {
      renderJournal(log(20))

      await userEvent.click(screen.getByRole('button', { name: 'Предыдущий разворот' }))

      expect(screen.getByText('разворот 1 · записей: 20')).toBeInTheDocument()
      expect(texts(left(1))).toEqual(numbers(1, 7))
      expect(texts(left(2))).toEqual(numbers(8, 14))
    })

    it('листание назад к старым и вперёд к новым; на краях кнопка неактивна', async () => {
      renderJournal(log(20))
      const back = screen.getByRole('button', { name: 'Предыдущий разворот' })
      const forward = screen.getByRole('button', { name: 'Следующий разворот' })
      expect(forward).toBeDisabled()
      expect(back).toBeEnabled()

      await userEvent.click(back)
      expect(back).toBeDisabled()
      expect(forward).toBeEnabled()

      await userEvent.click(forward)
      expect(screen.getByText('разворот 2 · записей: 20')).toBeInTheDocument()
      expect(texts(left(3))).toEqual(numbers(15, 20))
    })

    it('ровно разворот записей — один разворот, листать некуда', () => {
      renderJournal(log(14))

      expect(screen.getByText('разворот 1 · записей: 14')).toBeInTheDocument()
      expect(texts(left(1))).toEqual(numbers(1, 7))
      expect(texts(left(2))).toEqual(numbers(8, 14))
      expect(screen.getByRole('button', { name: 'Предыдущий разворот' })).toBeDisabled()
    })
  })

  describe('закладки-фильтры', () => {
    it('по умолчанию все закладки в положении «все»', () => {
      renderJournal(log(3))

      expect(screen.getByRole('button', { name: /Вид записи/ })).toHaveTextContent('все виды')
      expect(screen.getByRole('button', { name: /Портал/ })).toHaveTextContent('любой')
      expect(screen.getByRole('button', { name: /Мир/ })).toHaveTextContent('любой')
    })

    it('вид записи сужает книгу', async () => {
      renderJournal(log(9))

      await pickFilter(/Вид записи/, 'отказ')

      expect(screen.getByRole('button', { name: /Вид записи/ })).toHaveTextContent('отказ')
      expect(screen.getByText('разворот 1 · записей: 3')).toBeInTheDocument()
      expect(texts(left(1))).toEqual(['Запись 1', 'Запись 4', 'Запись 7'])
    })

    it('портал: варианты берутся из записей и сужают книгу', async () => {
      renderJournal([...log(4), logEntry(5, 'Без портала')])

      await userEvent.click(screen.getByRole('button', { name: /Портал/ }))
      expect(screen.getByRole('button', { name: 'ББ-310-1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'ПТ-420-1' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'ПТ-420-1' }))

      expect(texts(left(1))).toEqual(['Запись 2', 'Запись 4'])
      expect(screen.getByRole('button', { name: /Портал/ })).toHaveTextContent('ПТ-420-1')
    })

    it('мир сужает книгу', async () => {
      renderJournal(log(4))

      await pickFilter(/Мир/, BEZDNA)

      expect(texts(left(1))).toEqual(['Запись 1', 'Запись 3'])
    })

    it('фильтры складываются: вид и мир вместе', async () => {
      renderJournal(log(12))

      await pickFilter(/Вид записи/, 'система')
      await pickFilter(/Мир/, TOPI)

      // система — n % 3 === 2, Топи — чётные: 2, 8
      expect(texts(left(1))).toEqual(['Запись 2', 'Запись 8'])
    })

    it('«любой» снимает фильтр', async () => {
      renderJournal(log(4))
      await pickFilter(/Мир/, BEZDNA)

      await pickFilter(/Мир/, 'любой')

      expect(texts(left(1))).toEqual(numbers(1, 4))
    })

    it('смена фильтра возвращает на новейший разворот', async () => {
      renderJournal(log(40))
      await userEvent.click(screen.getByRole('button', { name: 'Предыдущий разворот' }))
      await userEvent.click(screen.getByRole('button', { name: 'Предыдущий разворот' }))
      expect(screen.getByText('разворот 1 · записей: 40')).toBeInTheDocument()

      await pickFilter(/Мир/, TOPI)

      // 20 чётных записей: два разворота, открыт новейший
      expect(screen.getByText('разворот 2 · записей: 20')).toBeInTheDocument()
      expect(texts(left(3))).toEqual(numbers(30, 40).filter((_, i) => i % 2 === 0))
    })

    it('фильтр без записей: книга пуста, подсказка про фильтр', async () => {
      renderJournal([logEntry(1, 'Только система', { kind: 'system' })])

      await pickFilter(/Вид записи/, 'отказ')

      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
      expect(screen.getByText('Под такой фильтр записей нет.')).toBeInTheDocument()
      expect(screen.getByText('разворот 1 · записей: 0')).toBeInTheDocument()
    })

    it('список закладки закрывается Escape и выбором значения', async () => {
      renderJournal(log(3))
      const ribbon = screen.getByRole('button', { name: /Вид записи/ })

      await userEvent.click(ribbon)
      expect(ribbon).toHaveAttribute('aria-expanded', 'true')
      await userEvent.keyboard('{Escape}')
      expect(ribbon).toHaveAttribute('aria-expanded', 'false')

      await userEvent.click(ribbon)
      await userEvent.click(screen.getByRole('button', { name: 'действие' }))
      expect(ribbon).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('«письмо» новой записи', () => {
    const WRITING = 'writing'
    // Отказ команды — самый короткий путь добавить запись в журнал через store
    const reject = (store: ReturnType<typeof renderJournal>['store'], portal = 'нет такого') =>
      act(() => {
        store.dispatch({ type: 'stabilize', portal })
      })
    const rejection = () => screen.getByText(/Отказ «Стабилизировать»/).closest('li')!

    it('при открытии книги новейшая запись не пишется заново', () => {
      renderJournal(log(3))

      expect(document.querySelector(`.${WRITING}`)).not.toBeInTheDocument()
    })

    it('запись, появившаяся при открытой книге, пишется; старые нет', () => {
      const { store } = renderJournal(log(3))

      reject(store)

      expect(rejection()).toHaveClass(WRITING)
      expect(rejection()).toHaveAttribute('data-kind', 'rejection')
      expect(document.querySelectorAll(`.${WRITING}`)).toHaveLength(1)
    })

    it('следующая запись переносит анимацию на себя', () => {
      const { store } = renderJournal(log(3))

      reject(store)
      act(() => {
        store.dispatch({ type: 'closePortal', portal: 'нет такого' })
      })

      const items = screen.getAllByRole('listitem')
      expect(items.filter((li) => li.classList.contains(WRITING))).toHaveLength(1)
      expect(items.at(-1)).toHaveClass(WRITING)
    })

    it('листание не запускает анимацию заново', async () => {
      const { store } = renderJournal(log(20))
      reject(store)

      await userEvent.click(screen.getByRole('button', { name: 'Предыдущий разворот' }))
      await userEvent.click(screen.getByRole('button', { name: 'Следующий разворот' }))

      expect(document.querySelector(`.${WRITING}`)).not.toBeInTheDocument()
    })

    it('анимация кончилась — класс снимается', () => {
      const { store } = renderJournal(log(3))
      reject(store)

      // В jsdom нет AnimationEvent, и React слушает событие с префиксом webkit
      fireEvent(rejection(), new Event('webkitAnimationEnd', { bubbles: true }))

      expect(rejection()).not.toHaveClass(WRITING)
    })

    it('новая запись, не прошедшая фильтр, не пишется потом при его снятии', async () => {
      const { store } = renderJournal(log(3))
      await pickFilter(/Вид записи/, 'действие')

      reject(store)
      await pickFilter(/Вид записи/, 'все виды')

      expect(rejection()).not.toHaveClass(WRITING)
    })
  })
})
