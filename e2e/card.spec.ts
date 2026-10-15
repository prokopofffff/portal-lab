import { expect, test, type Page } from '@playwright/test'

// Seed, при котором 50 тиков после openPortal дают критический портал (src/app/store.test.ts)
const SEED = 3

type LabGlobal = { __lab?: { advance(ticks: number): void } }

async function advance(page: Page, ticks: number): Promise<void> {
  await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), ticks)
}

// Открыть портал и довести его до критического; вернуть имя портала
async function criticalPortal(page: Page): Promise<string> {
  await page.goto(`/?seed=${SEED}&test=1`)
  await page.getByRole('button', { name: 'Арка 1 пуста — открыть портал' }).click()
  await advance(page, 50)
  await expect(page.locator('.px-portal--critical')).toHaveCount(1)
  const opened = page.getByRole('button', { name: /^Открыть карточку портала/ })
  return (await opened.getAttribute('aria-label'))!.replace('Открыть карточку портала ', '')
}

const RISK = /^(Низкий|Средний|Высокий|Критический) · \d+$/

test('записка → карточка: отказ с баннером и записью, стабилизация, Esc обратно в зал', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const name = await criticalPortal(page)

  // Записка «Тревожных знаков» открывает карточку поверх зала; у арки портала — рамка фокуса
  await page.getByRole('region', { name: 'Тревожные знаки' }).getByRole('button').click()
  const dialog = page.getByRole('dialog', { name })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Лаборатория порталов' })).toBeAttached()
  const ring = page.locator('[style*="outline: 3px dashed"]')
  await expect(ring).toHaveCount(1)
  await expect(ring).toContainText(name)

  // Недоступная способность нажимается → баннер «ОТКАЗ» с причиной из подсказки
  const abilities = dialog.getByRole('group', { name: 'Способности' })
  const send = abilities.getByRole('button', { name: 'Отправить наблюдателя' })
  await expect(send).toHaveAttribute('aria-disabled', 'true')
  const tipId = (await send.getAttribute('aria-describedby'))!
  const reason = (await page.locator(`[id="${tipId}"]`).textContent())!
  // Playwright считает aria-disabled кнопку неактивной и не кликает: жмём с клавиатуры
  await send.focus()
  await page.keyboard.press('Enter')
  const banner = page.getByRole('alert')
  await expect(banner).toContainText('ОТКАЗ')
  await expect(banner).toContainText(reason)
  // Отказ уже в истории карточки
  const refusal = `Отказ «Отправить наблюдателя» ${name}`
  await expect(dialog.getByText(refusal, { exact: false })).toBeVisible()

  // Стабилизация меняет балл в карточке: «было, стало» и чип снижения
  const risk = dialog.getByText(RISK)
  const before = await risk.textContent()
  await abilities.getByRole('button', { name: 'Стабилизировать' }).click()
  await expect(risk).not.toHaveText(before!)
  await expect(dialog.getByText(/^было \d+ %, стало \d+ %$/)).toBeVisible()
  await expect(dialog.getByText(/^риск снизился на \d+$/)).toBeAttached()

  // Стабилизация ушла в перезарядку: под курсором и фокусом — подсказка отказа. Первый Esc прячет
  // подсказку, второй закрывает карточку обратно в зал; рамки фокуса больше нет
  await expect(page.getByRole('tooltip')).toContainText('Кулдаун стабилизации')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Лаборатория порталов' })).toBeVisible()
  await expect(ring).toHaveCount(0)

  // Отказ записан и в книгу журнала
  await page.getByRole('link', { name: 'Книга журнала' }).click()
  await expect(page.getByText(refusal, { exact: false })).toBeAttached()
})

test('с клавиатуры: фокус в карточке, под ней ничего не достать Tab, Esc возвращает фокус', async ({
  page,
}) => {
  await criticalPortal(page)
  const note = page.getByRole('region', { name: 'Тревожные знаки' }).getByRole('button')
  await note.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeFocused()

  // Зал, HUD и док инертны: Tab ходит только по карточке
  let inside = 0
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab')
    await expect(page.locator('[inert]:focus, [inert] :focus')).toHaveCount(0)
    inside += await dialog.locator(':focus').count()
  }
  expect(inside).toBeGreaterThan(20)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(note).toBeFocused()
})

test('крестик и клик по затемнению закрывают карточку', async ({ page }) => {
  const name = await criticalPortal(page)
  const arch = page.getByRole('button', { name: `Открыть карточку портала ${name}` })

  await arch.click()
  await page.getByRole('button', { name: 'Закрыть карточку' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await arch.click()
  await page.getByTestId('card-overlay').click({ position: { x: 20, y: 400 } })
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
