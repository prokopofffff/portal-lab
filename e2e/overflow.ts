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
    // Текст только для скринридера нарочно не помещается: абсолютный блок не больше 1×1 px
    // с overflow: hidden — он сам и всё внутри него. Остальные блоки, даже сжатые до 0 px, в счёт
    // В e2e нет типов DOM (tsconfig.node): тип узла берём у root, getComputedStyle — с globalThis
    type Node = typeof root
    const computed = (
      globalThis as unknown as { getComputedStyle(el: Node): Record<string, string> }
    ).getComputedStyle
    const srOnly = (el: Node) => {
      const style = computed(el)
      return (
        style.position === 'absolute' &&
        style.overflow === 'hidden' &&
        el.clientWidth <= 1 &&
        el.clientHeight <= 1
      )
    }
    const insideSrOnly = (el: Node) => {
      for (let node: Node | null = el; node; node = node.parentElement as Node | null) {
        if (srOnly(node)) return true
      }
      return false
    }
    // Элементы, содержимое которых шире самих себя (текст, вылезающий из кнопки, и т. п.)
    const bad = [root, ...root.querySelectorAll('*')]
      .filter((el) => el.scrollWidth > el.clientWidth && !insideSrOnly(el))
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
    return { box: { left: rect.left, right: rect.right }, overflowing: bad }
  })
  expect(box.left, 'левый край левее окна').toBeGreaterThanOrEqual(0)
  expect(box.right, 'правый край правее окна').toBeLessThanOrEqual(inner)
  expect(overflowing, 'содержимое шире своего блока').toEqual([])
}
