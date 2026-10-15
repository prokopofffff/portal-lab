import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow } from './overflow.ts'

// AI Worklog — требование сдачи: экран внутри приложения, вкладка дока
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`AI Worklog на ${viewport.width} px: вкладка дока открывает экран, ничего не вылезает`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/?seed=3&test=1')
    const tab = page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', {
      name: 'AI Worklog',
    })
    await tab.click()
    await expect(tab).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { level: 1, name: 'AI WORKLOG' })).toBeVisible()
    for (const name of ['AI-инструменты', 'Время разработки', 'Токены', 'Этапы работы'])
      await expect(page.getByRole('region', { name })).toBeVisible()
    // Сводка токенов есть, само число не проверяем: оно пересчитывается
    await expect(page.getByRole('region', { name: 'Токены' })).toContainText('млн')
    await expectNoHorizontalOverflow(page)
    await expectNoHorizontalOverflow(page.getByRole('main'))
  })
}
