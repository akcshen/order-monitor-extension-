import { describe, it, expect } from 'vitest'
import {
  deriveMatchUrls,
  normalizeBuiltinPlatform,
  toChromeMatchPatterns,
  hrefMatchesPlatform,
  collectChromeMatchPatterns,
} from '../src/shared/builtin-platform-utils.js'

describe('deriveMatchUrls', () => {
  it('builds patterns from page url', () => {
    const urls = deriveMatchUrls('https://admin.example.com/orders')
    expect(urls).toContain('https://admin.example.com/orders')
    expect(urls.some((u) => u.includes('*'))).toBe(true)
  })
})

describe('toChromeMatchPatterns', () => {
  it('returns host-wide chrome match pattern', () => {
    expect(toChromeMatchPatterns('https://admin.example.com/orders?x=1')).toEqual([
      'https://admin.example.com/*',
    ])
  })

  it('skips REPLACE_ME placeholders', () => {
    expect(toChromeMatchPatterns('https://REPLACE_ME/orders')).toEqual([])
  })
})

describe('collectChromeMatchPatterns', () => {
  it('dedupes hosts', () => {
    const patterns = collectChromeMatchPatterns([
      { orderListUrl: 'https://a.example.com/orders' },
      { orderListUrl: 'https://a.example.com/other' },
      { orderListUrl: 'https://REPLACE_ME/x' },
    ])
    expect(patterns).toEqual(['https://a.example.com/*'])
  })
})

describe('hrefMatchesPlatform', () => {
  it('matches order list url prefix', () => {
    const p = normalizeBuiltinPlatform({
      id: 'x',
      name: 'x',
      orderListUrl: 'https://admin.example.com/orders',
    })
    expect(hrefMatchesPlatform(p, 'https://admin.example.com/orders?page=2')).toBe(true)
    expect(hrefMatchesPlatform(p, 'https://other.example.com/orders')).toBe(false)
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
    expect(p.pausedByLogin).toBe(false)
  })

  it('preserves previous enabled and pausedByLogin', () => {
    const p = normalizeBuiltinPlatform(
      {
        id: 'builtin-main',
        name: '测试',
        orderListUrl: 'https://admin.example.com/orders',
        enabled: true,
      },
      {
        preserveEnabled: true,
        previousEnabled: false,
        previousPausedByLogin: true,
      },
    )
    expect(p.enabled).toBe(false)
    expect(p.pausedByLogin).toBe(true)
  })
})
