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
  const rows = orders
    .map((o) => {
      const tds = [
        `<td>${escapeHtml(o.orderId)}</td>`,
        ...Object.values(o.fields || {}).map((v) => `<td>${escapeHtml(v)}</td>`),
      ].join('')
      return `<tr>${tds}</tr>`
    })
    .join('')
  const headers = ['订单号', ...Object.keys(orders[0]?.fields || {})]
    .map((h) => `<th>${escapeHtml(h)}</th>`)
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
