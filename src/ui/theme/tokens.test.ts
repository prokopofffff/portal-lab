import { describe, expect, it } from 'vitest'
import { cssVariables, risk } from './tokens'
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
})

describe('applyTheme', () => {
  it('записывает переменные в :root', () => {
    applyTheme(document.documentElement)
    expect(document.documentElement.style.getPropertyValue('--risk-critical-c')).toBe('#ff4466')
    expect(document.documentElement.style.getPropertyValue('--f-pixel')).toContain('Press Start 2P')
  })
})
