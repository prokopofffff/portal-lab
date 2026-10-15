import { expect, test, type Page } from '@playwright/test'

// Seed, при котором 50 тиков после openPortal дают критический портал (src/app/store.test.ts)
const SEED = 3

// В e2e нет DOM-типов, поэтому хук читаем через globalThis
type LabGlobal = { __lab?: { advance(ticks: number): void } }

async function advance(page: Page, ticks: number): Promise<void> {
  await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), ticks)
}

test('test=1 открывает хук __lab, время идёт только по advance', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&test=1`)
  expect(await page.evaluate(() => (globalThis as LabGlobal).__lab !== undefined)).toBe(true)

  // Тестовый режим стартует на паузе: время в HUD стоит, пока его не прокрутят
  await expect(page.getByRole('button', { name: 'Пауза' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('мин 0', { exact: true })).toBeVisible()

  await advance(page, 50)
  await expect(page.getByText('мин 50', { exact: true })).toBeVisible()

  await advance(page, 50)
  await expect(page.getByText('мин 100', { exact: true })).toBeVisible()
})

test('без test=1 хука __lab нет', async ({ page }) => {
  await page.goto('/')
  expect(await page.evaluate(() => (globalThis as LabGlobal).__lab)).toBeUndefined()
})

// Состояние ГСЧ из сохранения: тики ГСЧ не тратят, поэтому это состояние сразу после seed
async function savedRngState(page: Page): Promise<number> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('portal-lab')!).rngState)
}

test('seed из URL доходит до ГСЧ: другой seed — другое состояние', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&test=1`)
  await advance(page, 1)
  // mulberry32 хранит seed как есть: createRng(3).state() === 3
  expect(await savedRngState(page)).toBe(3)

  await page.evaluate(() => localStorage.clear())
  await page.goto('/?seed=4&test=1')
  await advance(page, 1)
  expect(await savedRngState(page)).toBe(4)
})

test('на паузе новая запись книги дописывается, а не замирает невидимой', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&test=1`)
  await page.getByRole('link', { name: 'Книга журнала' }).click()
  await page.getByRole('button', { name: 'Нанять' }).click()

  // toBeVisible не видит clip-path, поэтому проверяем вычисленный стиль
  const entry = page.locator('.journal-entry.writing')
  await expect(entry).toHaveCSS('animation-play-state', 'running')
  await expect(entry).not.toHaveCSS('clip-path', 'inset(0px 100% 0px 0px)', { timeout: 5000 })
})

test('пауза замораживает спрайты, ×1 их отпускает', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&test=1`)
  await page.getByRole('button', { name: 'Открыть портал в арке 1', exact: true }).click()
  await advance(page, 50)
  const critical = page.locator('.px-portal--critical').first()
  await expect(critical).toHaveCSS('animation-play-state', 'paused')

  await page.getByRole('button', { name: 'Скорость ×1' }).click()
  await expect(critical).toHaveCSS('animation-play-state', 'running')
})

test('HUD и док видны при прокрутке длинного экрана', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 })
  await page.goto(`/?seed=${SEED}&test=1`)
  await page.getByText('АРКА 12').scrollIntoViewIfNeeded()
  // Заголовок зала ушёл вверх — страница действительно прокручена
  const title = await page.getByRole('heading', { name: 'Лаборатория порталов' }).boundingBox()
  expect(title!.y).toBeLessThan(0)

  const hud = await page.getByRole('banner').boundingBox()
  expect(hud!.y).toBe(0)
  const dock = await page.getByRole('navigation', { name: 'Разделы' }).boundingBox()
  expect(dock!.y).toBeGreaterThan(600 - 84)
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(600)
})
