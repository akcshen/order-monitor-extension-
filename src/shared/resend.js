export async function sendResendEmail({
  apiKey,
  from,
  fromName,
  to,
  subject,
  text,
  html,
}) {
  if (!apiKey) return { ok: false, error: '缺少 Resend API Key', id: null }
  if (!to) return { ok: false, error: '缺少收件邮箱', id: null }
  if (!from) return { ok: false, error: '缺少发件邮箱', id: null }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${from}>` : from,
        to: [to],
        subject,
        text,
        html,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || `HTTP ${res.status}`,
        id: null,
      }
    }
    return { ok: true, error: null, id: data.id || null }
  } catch (e) {
    return { ok: false, error: e.message || String(e), id: null }
  }
}

export async function sendWithRetry(args, { retries = 2 } = {}) {
  let last = null
  for (let i = 0; i <= retries; i++) {
    last = await sendResendEmail(args)
    if (last.ok) return last
  }
  return last
}
