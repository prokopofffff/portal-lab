import { expect, test, type Locator, type Page } from '@playwright/test'

/*
 * E2E-сценарии из docs/spec.md §10. Часть уже закрыта другими файлами:
 * - пустая лаборатория — hall.spec.ts «пустая лаборатория показывает пустое состояние»;
 * - критический портал в зале, «Тревожных знаках» и карточке — hall.spec.ts и card.spec.ts;
 * - запрещённое действие → отказ с причиной → журнал — card.spec.ts «записка → карточка…»;
 * - стабилизация меняет балл и уровень — там же;
 * - закрытие с неизученными: диалог, отмена, подтверждение — card.spec.ts «закрытие последнего…».
 * Здесь — остальные. Seed'ы подобраны по домену: ГСЧ тратит только «Открыть портал», поэтому
 * k-й открытый портал при данном seed всегда один и тот же.
 */

// Порталы и миры, которые дают seed'ы ниже (первые открытия)
const OBSERVER = { seed: 12, portal: 'ЗС-226-1', world: 'Забытое Святилище' } // 2 существа, низкий риск
const SHARED = { seed: 878, first: 'ПУ-953-1', second: 'ПУ-953-2', world: 'Призрачное Ущелье' } // 15 существ
const DOOMED = { seed: 3, portal: 'ПП-076-1', world: 'Призрачная Пещера' } // 12 существ, время 57

test.use({ viewport: { width: 1440, height: 1000 } })

type LabGlobal = { __lab?: { advance(ticks: number): void } }

async function advance(page: Page, ticks: number): Promise<void> {
  await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), ticks)
}

const emptyArches = (page: Page) => page.getByRole('button', { name: /^Арка \d+ пуста/ })

// Открыть портал в первой свободной арке и дождаться, пока он в ней встанет
async function openPortal(page: Page): Promise<void> {
  const before = await emptyArches(page).count()
  await emptyArches(page).first().click()
  await expect(emptyArches(page)).toHaveCount(before - 1)
}

async function openCard(page: Page, portal: string): Promise<Locator> {
  await page.getByRole('button', { name: `Открыть карточку портала ${portal}` }).click()
  const card = page.getByRole('dialog', { name: portal })
  await expect(card).toBeVisible()
  return card
}

async function closeCard(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Закрыть карточку' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

// Рекомендованной способности читалка добавляет к имени «(рекомендуется)»
const ability = (card: Locator, name: string) =>
  card
    .getByRole('group', { name: 'Способности' })
    .getByRole('button', { name: new RegExp(`^${name}( \\(рекомендуется\\))?$`) })

// Значение счётчика сводки в HUD по его подписи
const stat = (page: Page, label: string) =>
  page
    .getByRole('banner')
    .locator('.hud-stat', { has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) })
    .locator('dd')

const slots = (page: Page, name: string) =>
  page.getByRole('banner').getByRole('img', { name, exact: true })

// Время симуляции из HUD: «мин 143» → 143
async function clock(page: Page): Promise<number> {
  const text = await page.getByRole('banner').locator('.hud-clock').textContent()
  return Number(/мин\s*(\d+)/.exec(text!)![1])
}

test('журнал после нескольких операций: все события в порядке появления', async ({ page }) => {
  const { seed, portal, world } = OBSERVER
  const label = `${portal} (${world})`
  await page.goto(`/?seed=${seed}&test=1`)
  await openPortal(page)
  const card = await openCard(page, portal)
  await ability(card, 'Стабилизировать').click()
  await ability(card, 'Отправить наблюдателя').click()
  await closeCard(page)
  await page.getByRole('button', { name: /Нанять/ }).click()
  await advance(page, 40)

  await page.getByRole('link', { name: 'Книга журнала' }).click()
  const entries = page.locator('li.journal-entry')
  await expect(entries).toHaveCount(8)
  expect(await entries.locator('> span:last-child').allTextContents()).toEqual([
    `Открыт портал ${label} — новый мир`,
    `Стабилизирован ${label}: балл риска 18 → 5`,
    `${label}: отправлен наблюдатель — на месте 1`,
    'Начат наём наблюдателя — будет через 20 мин',
    'Наём завершён: свободных наблюдателей +1',
    `${label}: изучено существо — 1 из 2`,
    `${label}: изучено существо — 2 из 2`,
    `Мир ${world} изучен: все существа (2) — наблюдатели вернулись: 1`,
  ])
  const kinds = await entries.evaluateAll((items) =>
    items.map((li) => li.getAttribute('data-kind')),
  )
  expect(kinds).toEqual([...Array(4).fill('action'), ...Array(4).fill('system')])
  const times = await entries.locator('> div > span:first-child').allTextContents()
  expect(times).toEqual([
    'мин 0',
    'мин 0',
    'мин 0',
    'мин 0',
    'мин 20',
    'мин 20',
    'мин 40',
    'мин 40',
  ])
})

test('наблюдатель: отправка, изучение, автовозврат', async ({ page }) => {
  const { seed, portal } = OBSERVER
  await page.goto(`/?seed=${seed}&test=1`)
  await openPortal(page)
  const card = await openCard(page, portal)
  const studied = card.getByText(/^\d+ из \d+$/)
  await expect(studied).toHaveText('0 из 2')

  // Отправка: наблюдатель из свободных переходит на место — в карточке и в HUD
  await ability(card, 'Отправить наблюдателя').click()
  await expect(card.getByTestId('slot-on')).toHaveCount(1)
  await expect(card.getByText('наблюдателей: 1')).toBeVisible()
  await expect(slots(page, 'Наблюдатель на месте, в портале')).toHaveCount(1)
  await expect(slots(page, 'Наблюдатель свободен')).toHaveCount(2)

  // 20 наблюдателе-тиков — одно существо
  await advance(page, 20)
  await expect(studied).toHaveText('1 из 2')
  await expect(card.getByTestId('slot-on')).toHaveCount(1)

  // Изучены все: наблюдатель сам вернулся свободным, отправлять больше некого изучать
  await advance(page, 20)
  await expect(studied).toHaveText('2 из 2')
  await expect(card.getByTestId('slot-on')).toHaveCount(0)
  await expect(card.getByText('наблюдателей нет')).toBeVisible()
  await expect(slots(page, 'Наблюдатель на месте, в портале')).toHaveCount(0)
  await expect(slots(page, 'Наблюдатель свободен')).toHaveCount(3)
  await expect(page.getByText('МИР ИЗУЧЕН', { exact: true })).toBeVisible()
  await expect(ability(card, 'Отправить наблюдателя')).toHaveAttribute('aria-disabled', 'true')
  await expect(stat(page, 'ИЗУЧЕНО СУЩЕСТВ')).toHaveText('2 / 2')
})

test('два портала в один мир: общий прогресс изучения, закрытие одного без диалога', async ({
  page,
}) => {
  const { seed, first, second } = SHARED
  await page.goto(`/?seed=${seed}&test=1`)
  await openPortal(page)
  await openPortal(page)

  // Оба портала изучают один мир: каждый за 20 тиков даёт по существу в общий счётчик
  let card = await openCard(page, first)
  await expect(
    card.getByRole('button', { name: `ещё 1 открытый портал в этот мир: ${second}` }),
  ).toBeVisible()
  await ability(card, 'Отправить наблюдателя').click()
  await closeCard(page)
  card = await openCard(page, second)
  await ability(card, 'Отправить наблюдателя').click()
  await advance(page, 20)
  await expect(card.getByText(/^\d+ из \d+$/)).toHaveText('2 из 15')
  await closeCard(page)
  card = await openCard(page, first)
  await expect(card.getByText(/^\d+ из \d+$/)).toHaveText('2 из 15')

  // В мир открыт ещё один портал — закрытие без свитка-подтверждения
  await ability(card, 'Отозвать наблюдателей').click()
  await ability(card, 'Закрыть').click()
  await expect(card.getByRole('group', { name: 'Способности' })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'ЗАКРЫТЬ ПОСЛЕДНИЙ ПОРТАЛ?' })).toHaveCount(0)
  await closeCard(page)
  await expect(stat(page, 'ЗАКРЫТО')).toHaveText('1')
  await expect(stat(page, 'ОТКРЫТО')).toHaveText('1 / 12')
  // Второй портал продолжает изучение
  card = await openCard(page, second)
  await expect(card.getByTestId('slot-on')).toHaveCount(1)
})

test('схлопывание с наблюдателем на месте → потеря в сводке', async ({ page }) => {
  const { seed, portal } = DOOMED
  await page.goto(`/?seed=${seed}&test=1`)
  await openPortal(page)
  const card = await openCard(page, portal)
  await ability(card, 'Отправить наблюдателя').click()
  await closeCard(page)
  await expect(slots(page, 'Наблюдатель на месте, в портале')).toHaveCount(1)

  // Время портала — 57 минут; наблюдатель не успел вернуться
  await advance(page, 57)
  await expect(page.getByRole('img', { name: 'Потеряно наблюдателей: 1' })).toBeVisible()
  await expect(stat(page, 'СХЛОПНУЛОСЬ')).toHaveText('1')
  await expect(stat(page, 'ОТКРЫТО')).toHaveText('0 / 12')
  await expect(slots(page, 'Наблюдатель на месте, в портале')).toHaveCount(0)
  await expect(slots(page, 'Наблюдатель свободен')).toHaveCount(2)
  await expect(page.getByText('ПОРТАЛ СХЛОПНУЛСЯ', { exact: true })).toBeVisible()
  await expect(page.getByText('НАБЛЮДАТЕЛИ ПОТЕРЯНЫ', { exact: true })).toBeVisible()
})

test('повторное посещение мира: новый портал, страница мира с посещениями и изученными', async ({
  page,
}) => {
  const { seed, first, second, world } = SHARED
  await page.goto(`/?seed=${seed}&test=1`)
  await openPortal(page)
  const card = await openCard(page, first)
  await ability(card, 'Отправить наблюдателя').click()
  await advance(page, 20)
  await closeCard(page)

  // Второе открытие при этом seed снова ведёт в тот же мир: новый портал с номером посещения 2
  await openPortal(page)
  await expect(
    page.getByRole('button', { name: `Открыть карточку портала ${second}` }),
  ).toBeVisible()
  await expect(stat(page, 'МИРОВ')).toHaveText('1')

  await page.getByRole('link', { name: 'Атлас миров' }).click()
  await page
    .getByRole('article', { name: world })
    .getByRole('link', { name: 'Страница мира →' })
    .click()
  await expect(page.getByRole('heading', { name: world, level: 1 })).toBeVisible()
  const summary = page.getByRole('group', { name: 'Сводка мира' })
  await expect(summary).toContainText('Посещений')
  await expect(summary.locator('b').first()).toHaveText('2')
  await expect(page.getByText('СУЩЕСТВА · ИЗУЧЕНО 1 ИЗ 15')).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(first) })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(second) })).toBeVisible()
})

test('лимит 12 открытых: все арки заняты, открыть новый некуда', async ({ page }) => {
  await page.goto('/?seed=3&test=1')
  for (let i = 0; i < 12; i++) await openPortal(page)

  // По дизайну (кадр 02-hall-full) пустых арок не остаётся — открыть 13-й из зала нечем;
  // отказ домена «все арки заняты» закреплён unit-тестом в src/domain/commands.test.ts
  await expect(emptyArches(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Открыть карточку портала/ })).toHaveCount(12)
  await expect(page.getByText('Все 12 арок заняты — открыть новый портал некуда')).toBeVisible()
  await expect(stat(page, 'ОТКРЫТО')).toHaveText('12 / 12')
})

test('перезагрузка страницы сохраняет состояние', async ({ page }) => {
  const { seed, first, second } = SHARED
  await page.goto(`/?seed=${seed}&test=1`)
  await openPortal(page)
  await openPortal(page)
  const card = await openCard(page, first)
  await ability(card, 'Отправить наблюдателя').click()
  await closeCard(page)
  await page.getByRole('button', { name: /Нанять/ }).click()
  await advance(page, 30)

  await page.reload()
  expect(await clock(page)).toBe(30)
  await expect(
    page.getByRole('button', { name: `Открыть карточку портала ${first}` }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: `Открыть карточку портала ${second}` }),
  ).toBeVisible()
  // Наём завершился до перезагрузки: 4 в штате, один из них на месте
  await expect(slots(page, 'Наблюдатель на месте, в портале')).toHaveCount(1)
  await expect(slots(page, 'Наблюдатель свободен')).toHaveCount(3)
  await expect(stat(page, 'ИЗУЧЕНО СУЩЕСТВ')).toHaveText('1 / 15')
  const restored = await openCard(page, first)
  await expect(restored.getByTestId('slot-on')).toHaveCount(1)

  // И журнал на месте
  await closeCard(page)
  await page.getByRole('link', { name: 'Книга журнала' }).click()
  await expect(
    page.getByText(`Открыт портал ${second} (${SHARED.world}) — повторное посещение`),
  ).toBeAttached()
})

test('пауза останавливает время', async ({ page }) => {
  await page.goto('/?seed=3&test=1')
  // Тестовый режим стартует на паузе; на ×20 время идёт само
  await page.getByRole('button', { name: 'Скорость ×20' }).click()
  await expect.poll(() => clock(page)).toBeGreaterThan(5)

  await page.getByRole('button', { name: 'Пауза' }).click()
  await expect(page.getByText('Пауза: время стоит, песок замер')).toBeVisible()
  const stopped = await clock(page)
  // На ×20 за секунду прошло бы 20 минут
  await page.waitForTimeout(1500)
  expect(await clock(page)).toBe(stopped)
})
