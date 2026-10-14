import { expect, test } from '@playwright/test'

test('приложение открывается', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Лаборатория порталов')
  await expect(page.getByRole('heading', { name: 'Лаборатория порталов' })).toBeVisible()
})
