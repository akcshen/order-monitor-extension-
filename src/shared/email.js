export function buildOrderEmail({ platformName, orders, now = new Date() }) {
  const n = orders.length
  const time = now.toLocaleString('zh-CN', { hour12: false })
  const subject = `【新订单】${platformName} · ${n} 单 · ${time}`
  const lines = orders.map((o) => {
    const extras = Object.entries(o.fields || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('，')
    return `- ${o.orderId}${extras ? `（${extras}）` : ''}`
  })
  const text = [`平台：${platformName}`, `时间：${time}`, '', ...lines].join('\n')
  const fieldKeys = []
  const seenKeys = new Set()
  for (const o of orders) {
    for (const k of Object.keys(o.fields || {})) {
      if (!seenKeys.has(k)) {
        seenKeys.add(k)
        fieldKeys.push(k)
      }
    }
  }
  const headers = ['订单号', ...fieldKeys]
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join('')
  const rows = orders
    .map((o) => {
      const tds = [
        `<td>${escapeHtml(o.orderId)}</td>`,
        ...fieldKeys.map((k) => `<td>${escapeHtml(o.fields?.[k] ?? '')}</td>`),
      ].join('')
      return `<tr>${tds}</tr>`
    })
    .join('')
  const html = `<p>平台：${escapeHtml(platformName)}</p><p>时间：${escapeHtml(
    time,
  )}</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`
  return { subject, text, html }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
