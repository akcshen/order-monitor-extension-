/**
 * 由访问路径推导 matchUrls（与 Popup 编辑器逻辑一致）。
 */
export function deriveMatchUrls(pageUrl) {
  const url = (pageUrl || '').trim()
  if (!url) return []
  const urls = [url]
  if (!url.endsWith('*')) urls.push(`${url}*`)
  try {
    const u = new URL(url)
    urls.push(`${u.origin}${u.pathname}*`)
  } catch (_) {
    /* ignore */
  }
  return [...new Set(urls)]
}

/**
 * 把内置草稿规范成完整 platform 记录。
 * @param {object} draft
 * @param {{ preserveEnabled?: boolean, previousEnabled?: boolean }} [opts]
 */
export function normalizeBuiltinPlatform(draft, opts = {}) {
  const orderListUrl = String(draft.orderListUrl || '').trim()
  const enabled =
    opts.preserveEnabled && typeof opts.previousEnabled === 'boolean'
      ? opts.previousEnabled
      : draft.enabled !== false

  return {
    id: String(draft.id),
    name: String(draft.name || draft.id),
    enabled,
    orderListUrl,
    matchUrls: Array.isArray(draft.matchUrls) && draft.matchUrls.length
      ? draft.matchUrls
      : deriveMatchUrls(orderListUrl),
    refreshSeconds: Math.max(15, Number(draft.refreshSeconds) || 60),
    apiUrlIncludes: String(draft.apiUrlIncludes || '').trim(),
    orderIdPath: String(draft.orderIdPath || '').trim(),
    orderFields: Array.isArray(draft.orderFields)
      ? draft.orderFields.map((f) => ({
          label: String(f.label || '').trim(),
          path: String(f.path || '').trim(),
        }))
      : [],
    rowSelector: String(draft.rowSelector || ''),
    orderIdSelector: String(draft.orderIdSelector || ''),
    fieldSelectors: Array.isArray(draft.fieldSelectors)
      ? draft.fieldSelectors.map((f) => ({
          label: String(f.label || '').trim(),
          selector: String(f.selector || '').trim(),
        }))
      : [],
    loginUrlIncludes: String(draft.loginUrlIncludes || ''),
    builtin: true,
  }
}
