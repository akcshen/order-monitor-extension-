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
})
