import { describe, it, expect } from 'vitest'
import { parseOrdersFromDom } from '../src/content/dom-parser.js'

describe('parseOrdersFromDom', () => {
  it('parses rows', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr class="row"><td class="no">O1</td><td class="shop">华润</td></tr>
        <tr class="row"><td class="no">O2</td><td class="shop">永辉</td></tr>
      </tbody></table>`
    const orders = parseOrdersFromDom(document, {
      rowSelector: 'tr.row',
      orderIdSelector: '.no',
      fieldSelectors: [{ label: '超市', selector: '.shop' }],
    })
    expect(orders).toEqual([
      { orderId: 'O1', fields: { 超市: '华润' } },
      { orderId: 'O2', fields: { 超市: '永辉' } },
    ])
  })
})
