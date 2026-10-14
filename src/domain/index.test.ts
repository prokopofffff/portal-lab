import { describe, expect, it } from 'vitest'
import { DOMAIN_READY } from './index'

describe('domain', () => {
  it('собирается и тестируется в node-окружении', () => {
    expect(DOMAIN_READY).toBe(true)
    expect('window' in globalThis).toBe(false)
  })
})
