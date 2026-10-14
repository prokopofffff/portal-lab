import { risk, type PortalLook } from '../theme/tokens'
import { Rune } from './Rune'
import './sprites.css'

function tagParts(look: PortalLook) {
  if (look === 'empty') return { rune: 'archived', plate: 'archived', word: 'ПУСТАЯ АРКА' } as const
  if (look === 'archived') {
    return { rune: 'archived', plate: 'archived', word: 'ЗАКРЫТ / СХЛОПНУЛСЯ' } as const
  }
  return { rune: look, plate: look, word: risk[look].label.toUpperCase() } as const
}

/** Плашка «руна + СЛОВО» под аркой: уровень риска читается формой и словом, не только цветом. */
export function RiskTag({ look }: { look: PortalLook }) {
  const { rune, plate, word } = tagParts(look)
  return (
    <span className="px-risk-tag" data-look={look} data-plate={plate}>
      <span className="px-risk-tag__rune" aria-hidden="true">
        <Rune level={rune} size={16} />
      </span>
      {word}
    </span>
  )
}
