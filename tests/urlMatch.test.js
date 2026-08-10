import { describe, it, expect } from 'vitest'
import { urlMatches } from '../src/shared/urlMatch.js'

describe('urlMatches', () => {
  it('returns false for empty pattern', () => {
    expect(urlMatches('', 'https://example.com/orders')).toBe(false)
    expect(urlMatches(null, 'https://example.com/orders')).toBe(false)
  })

  it('matches exact url', () => {
    expect(urlMatches('https://shop.example.com/orders', 'https://shop.example.com/orders')).toBe(
      true,
    )
  })

  it('matches wildcard pattern', () => {
    expect(
      urlMatches('https://shop.example.com/*', 'https://shop.example.com/orders?page=1'),
    ).toBe(true)
  })

  it('matches via substring fallback after stripping *', () => {
    expect(urlMatches('*orders*', 'https://shop.example.com/list/orders?x=1')).toBe(true)
  })

  it('rejects non-matching href', () => {
    expect(urlMatches('https://a.example.com/*', 'https://b.example.com/orders')).toBe(false)
  })
})
