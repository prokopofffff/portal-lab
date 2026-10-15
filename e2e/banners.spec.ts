import { expect, test, type Page } from '@playwright/test'

// Seed, при котором 50 тиков после openPortal дают критический портал (src/app/store.test.ts)
const SEED = 3

type LabGlobal = { __lab?: { advance(ticks: number): void } }

async function advance(page: Page, ticks: number): Promise<void> {
  await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), ticks)
}

// Критический портал: из карточки отправить наблюдателя нельзя — выйдет отказ
async function openCriticalCard(page: Page) {
  await page.goto(`/?seed=${SEED}&test=1`)
  await page.getByRole('button', { name: 'Открыть портал в арке 1', exact: true }).click()
  await advance(page, 50)
  await expect(page.locator('.px-portal--critical')).toHaveCount(1)
  await page.getByRole('region', { name: 'Тревожные знаки' }).getByRole('button').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

test('на 1440×1000 баннер отказа не закрывает способности карточки', async ({ page }) => {
  // Без въезда справа: баннер сразу на месте (bnIn отключён)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  const dialog = await openCriticalCard(page)
  const abilities = dialog.getByRole('group', { name: 'Способности' })

  const send = abilities.getByRole('button', { name: 'Отправить наблюдателя' })
  await send.focus()
  await page.keyboard.press('Enter')
  const banner = page.getByRole('alert')
  await expect(banner).toContainText('ОТКАЗ')

  const a = (await abilities.boundingBox())!
  const b = (await banner.boundingBox())!
  const intersects =
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  expect(intersects).toBe(false)

  // Раскладка кадра 05-card-rejection: карточка 300…900, полоса баннеров 940…1420
  const card = (await dialog.boundingBox())!
  expect(card.x + card.width).toBeCloseTo(900, 0)
  expect(b.x).toBeCloseTo(940, 0)
  expect(b.x + b.width).toBeCloseTo(1420, 0)
})

test('без карточки стопка баннеров под HUD: top 128, правый край 1412 (кадр 16-banners)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`/?seed=${SEED}&test=1`)
  // Второй «Нанять» подряд — отказ (найм уже идёт), баннер встаёт без карточки
  const hire = page.getByRole('button', { name: /Нанять/ })
  await hire.click()
  // Недоступная кнопка с aria-disabled для Playwright неактивна: второй раз жмём с клавиатуры
  await hire.focus()
  await page.keyboard.press('Enter')
  const banner = page.getByRole('alert')
  await expect(banner).toContainText('ОТКАЗ')
  const b = (await banner.boundingBox())!
  expect(b.y).toBeCloseTo(128, 0)
  expect(b.x + b.width).toBeCloseTo(1412, 0)
})

// Отказ за отказом без карточки: второй и следующие «Нанять» при идущем найме
async function refuseHires(page: Page, count: number) {
  const hire = page.getByRole('button', { name: /Нанять/ })
  await hire.click()
  await hire.focus()
  for (let i = 0; i < count; i++) await page.keyboard.press('Enter')
  // Курсор не над стопкой: колода сложена
  await page.mouse.move(0, 0)
}

test('баннер не закрывается, пока над ним курсор; после ухода закрывается по остатку', async ({
  page,
}) => {
  await page.clock.install()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`/?seed=${SEED}&test=1`)
  await refuseHires(page, 1)
  const banner = page.getByRole('alert')
  await expect(banner).toContainText('ОТКАЗ')

  await banner.hover()
  await page.clock.runFor(20_000)
  await expect(banner).toBeVisible()

  await page.mouse.move(0, 0)
  // До паузы прошло меньше секунды: осталось больше 5 с из 6
  await page.clock.runFor(4_500)
  await expect(banner).toBeVisible()
  await page.clock.runFor(2_000)
  await expect(banner).toHaveCount(0)
})

test('несколько баннеров лежат колодой; наведение раскрывает её и держит все таймеры', async ({
  page,
}) => {
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`/?seed=${SEED}&test=1`)
  await refuseHires(page, 3)
  const banners = page.getByRole('alert')
  await expect(banners).toHaveCount(3)
  const stack = page.locator('.banner-stack')
  await expect(stack).not.toHaveAttribute('data-open')
  const boxes = async () =>
    Promise.all((await banners.all()).map(async (b) => (await b.boundingBox())!))

  // Сложена: новейший сверху на месте кадра 16-banners, предыдущие под ним уже и выступают снизу
  const deck = await boxes()
  expect(deck[0]!.y).toBeCloseTo(128, 0)
  expect(deck[0]!.x + deck[0]!.width).toBeCloseTo(1412, 0)
  expect(deck[0]!.width).toBeCloseTo(480, 0)
  for (let i = 1; i < deck.length; i++) {
    expect(deck[i]!.width).toBeLessThan(deck[i - 1]!.width)
    const bottom = deck[i]!.y + deck[i]!.height
    expect(bottom).toBeGreaterThan(deck[i - 1]!.y + deck[i - 1]!.height)
    expect(bottom - (deck[0]!.y + deck[0]!.height)).toBeLessThanOrEqual(8 * i + 1)
  }
  // Новейший поверх остальных
  const onTop = await banners
    .first()
    .evaluate(
      (el, [x, y]) => el.contains(el.ownerDocument.elementFromPoint(x!, y!)),
      [deck[0]!.x + 100, deck[0]!.y + 40],
    )
  expect(onTop).toBe(true)

  // Наведение раскрывает колоду в столбец с зазором 12 px, новейший первым
  await banners.first().hover()
  await expect(stack).toHaveAttribute('data-open')
  const list = await boxes()
  expect(list[0]!.y).toBeCloseTo(128, 0)
  for (let i = 1; i < list.length; i++) {
    expect(list[i]!.width).toBeCloseTo(480, 0)
    expect(list[i]!.y).toBeCloseTo(list[i - 1]!.y + list[i - 1]!.height + 12, 0)
  }

  // Пока колода раскрыта, не уходит ни один баннер
  await page.clock.runFor(20_000)
  await expect(banners).toHaveCount(3)

  // Курсор ушёл — колода складывается, баннеры уходят по своим остаткам
  await page.mouse.move(0, 0)
  await expect(stack).not.toHaveAttribute('data-open')
  await page.clock.runFor(7_000)
  await expect(banners).toHaveCount(0)
})

test('въезд и уход плавные: без ступеней, ушедший доигрывает уход и убирается', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`/?seed=${SEED}&test=1`)
  await refuseHires(page, 2)
  const banners = page.locator('.banner')
  await expect(banners).toHaveCount(2)
  const timing = await banners
    .first()
    .evaluate((el) => el.ownerDocument.defaultView!.getComputedStyle(el).animationTimingFunction)
  expect(timing).not.toContain('steps')
  await page.getByRole('alert').first().getByRole('button', { name: 'Скрыть уведомление' }).click()
  await expect(page.locator('.banner-slot--leaving')).toHaveCount(1)
  await expect(page.locator('.banner-slot--leaving')).toHaveCount(0)
  await expect(banners).toHaveCount(1)
})
