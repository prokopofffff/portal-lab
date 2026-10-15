import { expect, test } from '@playwright/test'

test('свиток печати: фокус в нём, за ним ничего не достать Tab, Esc закрывает и возвращает фокус', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/?seed=3&test=1')
  const seal = page.getByRole('button', { name: 'Запечатать лабораторию' })
  await seal.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'ЗАПЕЧАТАТЬ ЛАБОРАТОРИЮ?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeFocused()

  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab')
    await expect(dialog.locator(':focus')).toHaveCount(1)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(seal).toBeFocused()
})
