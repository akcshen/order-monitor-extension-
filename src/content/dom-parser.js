export function parseOrdersFromDom(root, rule) {
  const { rowSelector, orderIdSelector, fieldSelectors = [] } = rule || {}
  if (!rowSelector || !orderIdSelector) return []
  const rows = root.querySelectorAll(rowSelector)
  const orders = []
  rows.forEach((row) => {
    const idEl = row.querySelector(orderIdSelector)
    const orderId = (idEl?.textContent || '').trim()
    if (!orderId) return
    const fields = {}
    for (const f of fieldSelectors) {
      const el = row.querySelector(f.selector)
      fields[f.label] = (el?.textContent || '').trim()
    }
    orders.push({ orderId, fields })
  })
  return orders
}
