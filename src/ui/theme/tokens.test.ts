import { describe, expect, it } from 'vitest'
import { cssVariables, risk, sprite } from './tokens'
import { applyTheme } from './applyTheme'

describe('cssVariables', () => {
  it('переводит имена цветов в kebab-case', () => {
    expect(cssVariables()['--c-text-muted']).toBe('#b4abc6')
  })

  it('содержит все уровни риска', () => {
    const vars = cssVariables()
    for (const level of Object.keys(risk)) {
      expect(vars[`--risk-${level}-c`]).toBeDefined()
      expect(vars[`--risk-${level}-plate`]).toBeDefined()
      expect(vars[`--risk-${level}-on`]).toBeDefined()
    }
  })

  it('отдаёт цвета атласа как --c-*', () => {
    const vars = cssVariables()
    expect(vars['--c-parchment-shade']).toBe('#bda877')
    expect(vars['--c-bar-study-next']).toBe('#7a64b8')
  })

  it('отдаёт цвета HUD и дока как --c-* и --s-*', () => {
    const vars = cssVariables()
    expect(vars['--c-control']).toBe('#221e2d')
    expect(vars['--c-pause-on']).toBe('#8fb4ff')
    expect(vars['--c-seal-edge']).toBe('#5a2b3a')
    expect(vars['--s-hourglass-frame']).toBe('#c9a24a')
  })

  it('отдаёт цвета спрайтов как --s-*', () => {
    const vars = cssVariables()
    expect(vars['--s-bar-unlit']).toBe(sprite.barUnlit)
    expect(vars['--s-studied-gold']).toBe('#e8b948')
    expect(vars['--s-unknown-edge']).toBe('#2e2840')
    expect(vars['--s-arch-stone']).toBe(sprite.archStone)
  })
})

describe('applyTheme', () => {
  it('записывает переменные в :root', () => {
    applyTheme(document.documentElement)
    expect(document.documentElement.style.getPropertyValue('--risk-critical-c')).toBe('#ff4466')
    expect(document.documentElement.style.getPropertyValue('--f-pixel')).toContain('Press Start 2P')
  })
})
