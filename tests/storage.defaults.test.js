import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  createEmptyPlatform,
} from '../src/shared/types.js'

describe('defaults', () => {
  it('DEFAULT_SETTINGS has required keys', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      enabled: true,
      resendApiKey: '',
      toEmail: '',
      fromEmail: '',
      fromName: '订单监控助手',
      mergeNewOrdersInOneEmail: true,
      autoOpenOrderListTab: true,
    })
  })

  it('DEFAULT_STATE has settings and platforms keys', () => {
    expect(DEFAULT_STATE).toHaveProperty('settings')
    expect(DEFAULT_STATE).toHaveProperty('platforms')
    expect(DEFAULT_STATE.settings).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_STATE.platforms).toEqual([])
  })

  it('createEmptyPlatform returns editable rule shell', () => {
    const p = createEmptyPlatform()
    expect(p.id).toBeTruthy()
    expect(p.refreshSeconds).toBe(60)
    expect(p.orderFields).toEqual([])
    expect(p.fieldSelectors).toEqual([])
    expect(p.loginUrlIncludes).toBe('')
  })
})
