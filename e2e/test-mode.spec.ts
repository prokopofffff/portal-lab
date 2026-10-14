import { expect, test, type Page } from '@playwright/test'

// Seed, при котором 50 тиков после openPortal дают критический портал (src/app/store.test.ts)
const SEED = 3

// В e2e нет DOM-типов, поэтому хук читаем через globalThis
type LabGlobal = { __lab?: { advance(ticks: number): void } }

// Время лаборатории из сохранения (HUD появится в следующей задаче)
async function savedTime(page: Page): Promise<number> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('portal-lab')!).lab.time)
}

async function advance(page: Page, ticks: number): Promise<void> {
  await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), ticks)
}

test('test=1 открывает хук __lab, время идёт только по advance', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&test=1`)
  expect(await page.evaluate(() => (globalThis as LabGlobal).__lab !== undefined)).toBe(true)

  await advance(page, 50)
  expect(await savedTime(page)).toBe(50)

  await advance(page, 50)
  expect(await savedTime(page)).toBe(100)
})

test('без test=1 хука __lab нет', async ({ page }) => {
  await page.goto('/')
  expect(await page.evaluate(() => (globalThis as LabGlobal).__lab)).toBeUndefined()
})
