import { MSG } from '../shared/messaging.js'
import { urlMatches } from '../shared/urlMatch.js'
import { extractOrdersFromJson } from '../shared/jsonPath.js'
import { parseOrdersFromDom } from './dom-parser.js'

const HOOK_SOURCE = 'order-monitor-hook'

/**
 * 优先同步注入（textContent），尽快挂钩 fetch/XHR；
 * 若页面 CSP / 环境禁止 inline，再回退 script.src。
 */
async function injectNetworkHook() {
  const url = chrome.runtime.getURL('src/injected/network-hook.js')
  try {
    const code = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`hook fetch ${r.status}`)
      return r.text()
    })
    const s = document.createElement('script')
    s.textContent = code
    ;(document.documentElement || document.head).appendChild(s)
    s.remove()
  } catch (_) {
    const s = document.createElement('script')
    s.src = url
    ;(document.documentElement || document.head).appendChild(s)
    s.remove()
  }
}

async function loadMatchingPlatforms() {
  const { platforms = [] } = await chrome.storage.local.get('platforms')
  const href = location.href
  return platforms.filter((p) => {
    if (!p?.enabled) return false
    const patterns = Array.isArray(p.matchUrls) ? p.matchUrls.filter(Boolean) : []
    if (patterns.some((pattern) => urlMatches(pattern, href))) return true
    // 兼容：仅配了访问路径、尚未生成 matchUrls 的旧数据
    const page = (p.orderListUrl || '').trim()
    if (page && (href === page || href.startsWith(page.split('?')[0]))) return true
    return false
  })
}

function sendOrders(platformId, orders, source) {
  if (!orders?.length) return
  chrome.runtime
    .sendMessage({
      type: MSG.ORDERS_CANDIDATES,
      platformId,
      orders,
      source,
    })
    .catch(() => {})
}

function tryDomParse(platforms) {
  for (const platform of platforms) {
    const orders = parseOrdersFromDom(document, {
      rowSelector: platform.rowSelector,
      orderIdSelector: platform.orderIdSelector,
      fieldSelectors: platform.fieldSelectors,
    })
    if (orders.length) {
      sendOrders(platform.id, orders, 'dom')
    }
  }
}

function handleNetworkPayload(platforms, url, body) {
  let urlMatched = false
  let extracted = false
  const urlStr = String(url || '')
  for (const platform of platforms) {
    if (!platform.apiUrlIncludes || !urlStr.includes(platform.apiUrlIncludes)) continue
    urlMatched = true
    const orders = extractOrdersFromJson(body, platform.orderIdPath, platform.orderFields)
    if (orders.length) {
      sendOrders(platform.id, orders, 'api')
      extracted = true
    }
  }
  // 仅当 URL 命中 apiUrlIncludes 但 JSON 未抽出订单时，才回退 DOM
  if (urlMatched && !extracted) {
    tryDomParse(platforms)
  }
}

function checkLogin(platforms) {
  const href = location.href
  for (const platform of platforms) {
    if (platform.loginUrlIncludes && href.includes(platform.loginUrlIncludes)) {
      chrome.runtime
        .sendMessage({
          type: MSG.LOGIN_DETECTED,
          platformId: platform.id,
          href,
        })
        .catch(() => {})
    }
  }
}

async function main() {
  console.log('[order-monitor] content script loaded', location.href)

  let platforms = []
  let platformsReady = false
  const pendingPayloads = []

  // 在 await storage / 注入钩子之前挂上 listener，避免早期 NETWORK_PAYLOAD 丢失
  window.addEventListener('message', (event) => {
    // 仅处理同源 page-world 钩子消息，避免跨站伪造
    if (event.source !== window) return
    const data = event.data
    if (!data || data.source !== HOOK_SOURCE || data.type !== 'NETWORK_PAYLOAD') return
    if (!platformsReady) {
      pendingPayloads.push({ url: data.url, body: data.body })
      return
    }
    if (!platforms.length) return
    handleNetworkPayload(platforms, data.url, data.body)
  })

  platforms = await loadMatchingPlatforms()
  platformsReady = true

  // 未匹配平台时不改写页面 fetch/XHR
  if (platforms.length) {
    await injectNetworkHook()
  }

  checkLogin(platforms)

  for (const payload of pendingPayloads.splice(0)) {
    if (!platforms.length) break
    handleNetworkPayload(platforms, payload.url, payload.body)
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.platforms) return
    loadMatchingPlatforms().then(async (next) => {
      const had = platforms.length > 0
      platforms = next
      if (!had && platforms.length) {
        await injectNetworkHook()
      }
      checkLogin(platforms)
    })
  })

  const runDomWhenReady = () => {
    if (!platforms.length) return
    tryDomParse(platforms)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runDomWhenReady, { once: true })
  } else {
    runDomWhenReady()
  }
}

main()
