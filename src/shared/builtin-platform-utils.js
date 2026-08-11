import { urlMatches } from './urlMatch.js'

/**
 * 由访问路径推导 matchUrls（运行时 URL 匹配用）。
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
 * 转成 Chrome content_scripts / host_permissions 可用的 match pattern。
 * @returns {string[]}
 */
export function toChromeMatchPatterns(pageUrl) {
  const url = (pageUrl || '').trim()
  if (!url || url.includes('REPLACE_ME')) return []
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return []
    return [`${u.protocol}//${u.host}/*`]
  } catch (_) {
    return []
  }
}

export function collectChromeMatchPatterns(platforms) {
  const set = new Set()
  for (const p of platforms || []) {
    for (const m of toChromeMatchPatterns(p.orderListUrl)) set.add(m)
  }
  return [...set]
}

export function hrefMatchesPlatform(platform, href) {
  if (!platform || !href) return false
  const patterns =
    Array.isArray(platform.matchUrls) && platform.matchUrls.length
      ? platform.matchUrls
      : deriveMatchUrls(platform.orderListUrl)
  if (patterns.some((pattern) => urlMatches(pattern, href))) return true
  const page = (platform.orderListUrl || '').trim()
  if (!page || page.includes('REPLACE_ME')) return false
  return href === page || href.startsWith(page.split('?')[0])
}

/**
 * @param {object} draft
 * @param {{ preserveEnabled?: boolean, previousEnabled?: boolean, previousPausedByLogin?: boolean }} [opts]
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
    pausedByLogin: Boolean(opts.previousPausedByLogin),
    orderListUrl,
    matchUrls:
      Array.isArray(draft.matchUrls) && draft.matchUrls.length
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
