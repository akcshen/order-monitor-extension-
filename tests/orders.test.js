import { describe, it, expect } from 'vitest'
import { diffNewOrders } from '../src/shared/orders.js'

describe('diffNewOrders', () => {
  it('first run only builds baseline', () => {
    const seen = {}
    const { newOrders, nextSeen } = diffNewOrders(seen, 'p1', [
      { orderId: '1', fields: {} },
      { orderId: '2', fields: {} },
    ])
    expect(newOrders).toEqual([])
    expect(nextSeen.p1.baselineReady).toBe(true)
    expect(nextSeen.p1.ids).toEqual(['1', '2'])
  })

  it('returns only unseen orders after baseline', () => {
    const seen = { p1: { ids: ['1', '2'], baselineReady: true } }
    const { newOrders, nextSeen } = diffNewOrders(seen, 'p1', [
      { orderId: '2', fields: {} },
      { orderId: '3', fields: { 超市: '永辉' } },
    ])
    expect(newOrders).toEqual([{ orderId: '3', fields: { 超市: '永辉' } }])
    expect(nextSeen.p1.ids).toContain('3')
  })
})
