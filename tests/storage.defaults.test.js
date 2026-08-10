import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, createEmptyPlatform } from '../src/shared/types.js'

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

  it('createEmptyPlatform returns editable rule shell', () => {
    const p = createEmptyPlatform()
    expect(p.id).toBeTruthy()
    expect(p.refreshSeconds).toBe(60)
    expect(p.orderFields).toEqual([])
    expect(p.fieldSelectors).toEqual([])
  })
})
