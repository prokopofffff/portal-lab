import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { NavigationProvider, useRoute } from '../../app/navigation'
import { RouteLink } from './RouteLink'

function Where() {
  return <output>{useRoute().screen}</output>
}

function renderLink() {
  render(
    <NavigationProvider>
      <RouteLink to={{ screen: 'atlas' }}>Атлас</RouteLink>
      <Where />
    </NavigationProvider>,
  )
  return screen.getByRole('link', { name: 'Атлас' })
}

describe('RouteLink', () => {
  it('без href: новой вкладке открывать нечего', () => {
    expect(renderLink()).not.toHaveAttribute('href')
  })

  it('клик переходит на экран, в том числе с модификатором', async () => {
    const user = userEvent.setup()
    const link = renderLink()
    await user.keyboard('{Meta>}')
    await user.click(link)
    expect(screen.getByRole('status')).toHaveTextContent('atlas')
  })

  it('с клавиатуры: Tab до ссылки и Enter; пробел не переходит', async () => {
    const user = userEvent.setup()
    renderLink()
    await user.tab()
    await user.keyboard(' ')
    expect(screen.getByRole('status')).toHaveTextContent('hall')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('atlas')
  })
})
