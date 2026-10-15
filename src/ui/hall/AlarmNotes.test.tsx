import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { attentionList } from '../../domain'
import { labWith, portal, storeWithLab, world } from '../../test/labFixtures'
import { renderScreen } from '../../test/renderScreen'
import { risk } from '../theme/tokens'
import { AlarmNotes } from './AlarmNotes'

const TOPI = 'Пепельные Топи'
const ZERK = 'Шепчущее Зеркало'
const BEZ = 'Багровая Бездна'
const worlds = {
  [TOPI]: world(TOPI, 'ПТ-420', { creatures: 9, studied: 3 }),
  [ZERK]: world(ZERK, 'ШЗ-793', { creatures: 2, studied: 2 }),
  [BEZ]: world(BEZ, 'ББ-310', { creatures: 12, studied: 0 }),
}

const critical = portal('ПТ-420-1', TOPI, {
  arch: 0,
  energy: 82,
  stability: 14,
  timeLeft: 8,
  observers: 2,
})
const calm = portal('ШЗ-793-1', ZERK, { arch: 1, energy: 22, stability: 90, timeLeft: 310 })
const middling = portal('ББ-310-1', BEZ, { arch: 2, energy: 91, stability: 35, timeLeft: 46 })

function renderNotes(portals = [critical, calm, middling]) {
  const lab = labWith({ worlds, portals })
  return { lab, ...renderScreen(<AlarmNotes />, storeWithLab(lab)) }
}

const region = () => screen.getByRole('region', { name: 'Тревожные знаки' })

describe('Записки «Тревожных знаков»', () => {
  it('до трёх записок в порядке списка внимания: риск, заголовок и причина', () => {
    const { lab } = renderNotes()
    const expected = attentionList(lab)
    expect(expected).toHaveLength(3)
    // Порядок домена: критический портал первым
    expect(expected[0]!.portal).toBe(critical.name)

    const notes = within(region()).getAllByRole('button')
    expect(notes).toHaveLength(3)
    expected.forEach((item, i) => {
      const note = within(notes[i]!)
      expect(note.getByText(`${item.portal} · ${item.world}`)).toBeInTheDocument()
      expect(note.getByText(item.reason)).toBeInTheDocument()
      expect(note.getByText(risk[item.level].label.toUpperCase())).toBeInTheDocument()
    })
    expect(within(notes[0]!).getByText('КРИТИЧЕСКИЙ')).toBeInTheDocument()
    expect(
      within(notes[0]!).getByText(
        'критический · схлопнется через 8 мин · не изучено 6 · на месте 2 наблюдателя',
      ),
    ).toBeInTheDocument()
  })

  it('принятый как есть портал не показывается', () => {
    renderNotes([critical, { ...calm, acceptedAt: 'low' }, middling])
    const notes = within(region()).getAllByRole('button')
    expect(notes).toHaveLength(2)
    expect(within(region()).queryByText(/ШЗ-793-1/)).not.toBeInTheDocument()
  })

  it('больше трёх порталов — только три самых тревожных', () => {
    const extra = portal('ПТ-420-2', TOPI, { arch: 3, energy: 10, stability: 95, timeLeft: 900 })
    renderNotes([critical, calm, middling, extra])
    expect(within(region()).getAllByRole('button')).toHaveLength(3)
  })

  it('клик по записке открывает карточку портала с возвратом в зал', async () => {
    const { route } = renderNotes()
    await userEvent.click(within(region()).getByRole('button', { name: /ПТ-420-1/ }))
    expect(route()).toEqual({
      screen: 'portal',
      portal: 'ПТ-420-1',
      back: { screen: 'hall' },
    })
  })

  it('имя записки — её видимый текст, руна скрыта', () => {
    renderNotes([critical])
    expect(
      screen.getByRole('button', {
        name: /^КРИТИЧЕСКИЙ ПТ-420-1 · Пепельные Топи критический · схлопнется/,
      }),
    ).toBeInTheDocument()
  })

  it('все открытые порталы приняты — тихая панель вместо записок', () => {
    renderNotes([
      { ...critical, acceptedAt: 'critical' },
      { ...calm, acceptedAt: 'low' },
    ])
    expect(within(region()).queryAllByRole('button')).toHaveLength(0)
    expect(
      within(region()).getByText('Тревожных знаков нет — все открытые порталы приняты как есть'),
    ).toBeInTheDocument()
  })
})
