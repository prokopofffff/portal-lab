import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PortalLook } from '../theme/tokens'
import { RiskTag } from './RiskTag'

const cases: [PortalLook, string, string][] = [
  ['empty', 'ПУСТАЯ АРКА', 'archived'],
  ['low', 'НИЗКИЙ', 'low'],
  ['medium', 'СРЕДНИЙ', 'medium'],
  ['high', 'ВЫСОКИЙ', 'high'],
  ['critical', 'КРИТИЧЕСКИЙ', 'critical'],
  ['archived', 'ЗАКРЫТ / СХЛОПНУЛСЯ', 'archived'],
]

describe('RiskTag', () => {
  it.each(cases)('вид «%s»: слово «%s» и руна «%s»', (look, word, rune) => {
    const { container } = render(<RiskTag look={look} />)
    const tag = container.firstElementChild as HTMLElement
    expect(tag).toHaveAttribute('data-look', look)
    expect(tag).toHaveTextContent(word)
    expect(tag.querySelector('svg')).toHaveAttribute('data-level', rune)
  })

  it('руна на плашке декоративна: уровень называет слово', () => {
    render(<RiskTag look="high" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('ВЫСОКИЙ')).toBeVisible()
  })
})
