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
  await page.getByRole('button', { name: 'Открыть портал в арке 1', exact: true }).click()
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

test('подсказка отказа от наведения: курсор переходит на неё, Esc прячет без закрытия карточки', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const name = await criticalPortal(page)
  await page.getByRole('button', { name: `Открыть карточку портала ${name}` }).click()
  const dialog = page.getByRole('dialog', { name })
  const send = dialog
    .getByRole('group', { name: 'Способности' })
    .getByRole('button', { name: 'Отправить наблюдателя' })
  await expect(send).toHaveAttribute('aria-disabled', 'true')
  const tip = page.getByRole('tooltip')

  // Курсор с кнопки вверх на подсказку, через зазор между ними: подсказка не пропадает (WCAG 1.4.13)
  const button = (await send.boundingBox())!
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2)
  await expect(tip).toBeVisible()
  const box = (await tip.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 })
  await expect(tip).toBeVisible()

  // Фокус на диалоге, не на кнопке: Esc прячет подсказку, карточка остаётся; следующий — закрывает
  await expect(dialog).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(tip).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
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

test('закрытие последнего портала: свиток, «Отмена» пишет в журнал, «Закрыть всё равно» закрывает', async ({
  page,
}) => {
  const name = await criticalPortal(page)
  await page.getByRole('button', { name: `Открыть карточку портала ${name}` }).click()
  const card = page.getByRole('dialog', { name })
  const close = card.getByRole('group', { name: 'Способности' }).getByRole('button', {
    name: 'Закрыть',
  })

  await close.click()
  const scroll = page.getByRole('dialog', { name: 'ЗАКРЫТЬ ПОСЛЕДНИЙ ПОРТАЛ?' })
  await expect(scroll).toBeVisible()
  await expect(scroll).toContainText('Это последний открытый портал в')
  await expect(scroll.getByRole('button', { name: 'Отмена' })).toBeFocused()

  // «Отмена»: портал открыт, карточка на месте, фокус вернулся на «Закрыть»
  await scroll.getByRole('button', { name: 'Отмена' }).click()
  await expect(scroll).toHaveCount(0)
  await expect(card).toBeVisible()
  await expect(close).toBeFocused()
  await expect(card.getByText(/^Закрытие .* отменено$/)).toBeVisible()

  // «Закрыть всё равно»: портал закрыт, способности исчезли
  await close.click()
  await page.getByRole('button', { name: 'Закрыть всё равно' }).click()
  await expect(scroll).toHaveCount(0)
  await expect(card.getByRole('group', { name: 'Способности' })).toHaveCount(0)
  await expect(card).toBeFocused()

  // Отмена осталась в книге журнала
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Книга журнала' }).click()
  await expect(page.getByText(/^Закрытие .* отменено$/)).toBeAttached()
})

test('«Под вопросом»: заметка в свитке, протяжки мышью его не отменяют, пометка на карте и в зале', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const name = await criticalPortal(page)
  await page.getByRole('button', { name: `Открыть карточку портала ${name}` }).click()
  const card = page.getByRole('dialog', { name })
  await card
    .getByRole('group', { name: 'Способности' })
    .getByRole('button', { name: 'Под вопросом' })
    .click()

  const scroll = page.getByRole('dialog', { name: 'ПОМЕТИТЬ «ПОД ВОПРОСОМ»' })
  const field = scroll.getByRole('textbox', { name: /Заметка/ })
  await expect(field).toBeFocused()
  await field.fill('Руны мерцают не в такт')

  // Нажатие на затемнении, отпущенное на свитке, и выделение заметки, отпущенное на затемнении, —
  // не клик по затемнению: свиток и заметка остаются
  const box = (await scroll.boundingBox())!
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(10, 10)
  await page.mouse.down()
  await page.mouse.move(centre.x, centre.y, { steps: 5 })
  await page.mouse.up()
  await expect(scroll).toBeVisible()

  const fieldBox = (await field.boundingBox())!
  await page.mouse.move(fieldBox.x + 10, fieldBox.y + fieldBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(10, 10, { steps: 5 })
  await page.mouse.up()
  await expect(scroll).toBeVisible()
  await expect(field).toHaveValue('Руны мерцают не в такт')

  await scroll.getByRole('button', { name: 'Пометить' }).click()
  await expect(scroll).toHaveCount(0)
  await expect(card.getByText('ПОД ВОПРОСОМ', { exact: true })).toBeVisible()
  await expect(card.getByText('Руны мерцают не в такт', { exact: true })).toBeVisible()
  // Заметка попала и в историю портала
  await expect(card.getByText(/пометка «Под вопросом» — Руны мерцают не в такт$/)).toBeAttached()

  // В зале у арки значок пометки
  await page.keyboard.press('Escape')
  await expect(card).toHaveCount(0)
  await expect(page.getByLabel('Под вопросом', { exact: true })).toHaveCount(1)
})

test('на десктопе карточка открывается в 20 px от верха, затемнение не прокручено', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 })
  const name = await criticalPortal(page)
  await page.getByRole('button', { name: `Открыть карточку портала ${name}` }).click()
  const card = page.getByRole('dialog', { name })
  await expect(card).toBeFocused()
  // Как в кадре 04-card-critical (top: 20px): фокус на диалоге выше окна не прокручивает затемнение
  expect(await page.getByTestId('card-overlay').evaluate((el) => el.scrollTop)).toBe(0)
  expect((await card.boundingBox())!.y).toBeCloseTo(20, 0)
})
