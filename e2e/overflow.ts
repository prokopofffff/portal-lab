import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Рамка элемента внутри окна и сам элемент без горизонтальной прокрутки: нигде не вылезает за
 * 0…ширина окна, а его и его потомков scrollWidth не больше clientWidth. Для страницы целиком
 * проверяется документ.
 */
export async function expectNoHorizontalOverflow(target: Page | Locator): Promise<void> {
  if ('goto' in target) {
    const inner = target.viewportSize()!.width
    const scroll = await target.evaluate((): number => {
      return (globalThis as unknown as { document: { documentElement: { scrollWidth: number } } })
        .document.documentElement.scrollWidth
    })
    expect(scroll, 'документ шире окна').toBeLessThanOrEqual(inner)
    return
  }
  const inner = target.page().viewportSize()!.width
  const { box, overflowing } = await target.evaluate((root) => {
    const rect = root.getBoundingClientRect()
    // Элементы, содержимое которых шире самих себя (текст, вылезающий из кнопки, и т. п.);
    // блоки в 1 px — текст только для скринридера, он нарочно не помещается
    const bad = [root, ...root.querySelectorAll('*')]
      .filter((el) => el.scrollWidth > el.clientWidth && el.clientWidth > 1)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
    return { box: { left: rect.left, right: rect.right }, overflowing: bad }
  })
  expect(box.left, 'левый край левее окна').toBeGreaterThanOrEqual(0)
  expect(box.right, 'правый край правее окна').toBeLessThanOrEqual(inner)
  expect(overflowing, 'содержимое шире своего блока').toEqual([])
}
