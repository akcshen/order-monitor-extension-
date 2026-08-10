import { describe, it, expect } from 'vitest'
import { buildOrderEmail } from '../src/shared/email.js'

describe('buildOrderEmail', () => {
  it('builds subject and includes order id', () => {
    const mail = buildOrderEmail({
      platformName: '测试平台',
      orders: [{ orderId: 'X9', fields: { 超市: '华润' } }],
      now: new Date('2026-08-10T10:00:00+08:00'),
    })
    expect(mail.subject).toContain('测试平台')
    expect(mail.subject).toContain('1 单')
    expect(mail.text).toContain('X9')
    expect(mail.html).toContain('华润')
  })

  it('aligns html table columns when orders have different field keys', () => {
    const mail = buildOrderEmail({
      platformName: '测试平台',
      orders: [
        { orderId: 'A1', fields: { 超市: '华润', 金额: '100' } },
        { orderId: 'B2', fields: { 金额: '200', 地址: '北京' } },
      ],
      now: new Date('2026-08-10T10:00:00+08:00'),
    })
    expect(mail.html).toContain('<th>超市</th>')
    expect(mail.html).toContain('<th>金额</th>')
    expect(mail.html).toContain('<th>地址</th>')
    const rows = mail.html.match(/<tbody>(.*?)<\/tbody>/s)[1].match(/<tr>.*?<\/tr>/gs)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toBe('<tr><td>A1</td><td>华润</td><td>100</td><td></td></tr>')
    expect(rows[1]).toBe('<tr><td>B2</td><td></td><td>200</td><td>北京</td></tr>')
  })
})
