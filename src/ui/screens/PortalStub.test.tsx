import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { labWith, portal, storeWithLab, world } from '../../test/labFixtures'
import { renderScreen } from '../../test/renderScreen'
import { PortalStub } from './PortalStub'

const lab = labWith({
  worlds: { 'Пепельные Топи': world('Пепельные Топи', 'ПТ-420') },
  portals: [portal('ПТ-420-1', 'Пепельные Топи')],
})

describe('заглушка карточки портала', () => {
  it('показывает имя портала и ссылку на его мир', async () => {
    const { route } = renderScreen(<PortalStub portal="ПТ-420-1" />, storeWithLab(lab), {
      screen: 'portal',
      portal: 'ПТ-420-1',
      back: { screen: 'hall' },
    })

    expect(screen.getByRole('heading', { name: 'ПТ-420-1' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Пепельные Топи' }))
    expect(route()).toEqual({ screen: 'world', world: 'Пепельные Топи' })
  })

  it('неизвестный портал: сообщение, а не падение', () => {
    renderScreen(<PortalStub portal="ХХ-000-1" />, storeWithLab(lab))

    expect(screen.getByText('Портал ХХ-000-1 не найден')).toBeInTheDocument()
  })
})
