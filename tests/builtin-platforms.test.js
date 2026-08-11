import { describe, it, expect } from 'vitest'
import {
  deriveMatchUrls,
  normalizeBuiltinPlatform,
} from '../src/shared/builtin-platform-utils.js'

describe('deriveMatchUrls', () => {
  it('builds patterns from page url', () => {
    const urls = deriveMatchUrls('https://admin.example.com/orders')
    expect(urls).toContain('https://admin.example.com/orders')
    expect(urls.some((u) => u.includes('*'))).toBe(true)
  })
})

describe('normalizeBuiltinPlatform', () => {
  it('marks builtin and derives matchUrls', () => {
    const p = normalizeBuiltinPlatform({
      id: 'builtin-main',
      name: '测试',
      orderListUrl: 'https://admin.example.com/orders',
      apiUrlIncludes: '/api/order/list',
      orderIdPath: 'data.list[].orderNo',
      enabled: true,
    })
    expect(p.builtin).toBe(true)
    expect(p.matchUrls.length).toBeGreaterThan(0)
    expect(p.apiUrlIncludes).toBe('/api/order/list')
  })

  it('preserves previous enabled when asked', () => {
    const p = normalizeBuiltinPlatform(
      {
        id: 'builtin-main',
        name: '测试',
        orderListUrl: 'https://admin.example.com/orders',
        enabled: true,
      },
      { preserveEnabled: true, previousEnabled: false },
    )
    expect(p.enabled).toBe(false)
  })
})
