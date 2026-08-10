import { describe, it, expect } from 'vitest'
import { getByPath, extractOrdersFromJson } from '../src/shared/jsonPath.js'

describe('getByPath', () => {
  it('reads nested keys', () => {
    expect(getByPath({ a: { b: 1 } }, 'a.b')).toBe(1)
  })

  it('expands array with []', () => {
    const data = { list: [{ id: '1' }, { id: '2' }] }
    expect(getByPath(data, 'list[].id')).toEqual(['1', '2'])
  })
})

describe('extractOrdersFromJson', () => {
  it('builds orders from list path', () => {
    const json = {
      data: {
        list: [
          { orderNo: 'A1', shopName: '华润', amount: 12.5 },
          { orderNo: 'A2', shopName: '永辉', amount: 9 },
        ],
      },
    }
    const orders = extractOrdersFromJson(json, 'data.list[].orderNo', [
      { label: '超市', path: 'shopName' },
      { label: '金额', path: 'amount' },
    ])
    expect(orders).toEqual([
      { orderId: 'A1', fields: { 超市: '华润', 金额: '12.5' } },
      { orderId: 'A2', fields: { 超市: '永辉', 金额: '9' } },
    ])
  })

  it('skips rows without orderId', () => {
    const json = { list: [{ orderNo: '' }, { orderNo: 'B1' }] }
    const orders = extractOrdersFromJson(json, 'list[].orderNo', [])
    expect(orders).toEqual([{ orderId: 'B1', fields: {} }])
  })
})
