import { MSG } from '../shared/messaging.js'
import { urlMatches } from '../shared/urlMatch.js'
import { extractOrdersFromJson } from '../shared/jsonPath.js'
import { parseOrdersFromDom } from './dom-parser.js'

const HOOK_SOURCE = 'order-monitor-hook'

function injectNetworkHook() {
  const s = document.createElement('script')
  s.src = chrome.runtime.getURL('src/injected/network-hook.js')
  ;(document.documentElement || document.head).appendChild(s)
  s.remove()
}

async function loadMatchingPlatforms() {
  const { platforms = [] } = await chrome.storage.local.get('platforms')
  const href = location.href
  return platforms.filter(
    (p) =>
      p?.enabled &&
      Array.isArray(p.matchUrls) &&
      p.matchUrls.some((pattern) => urlMatches(pattern, href)),
  )
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
  injectNetworkHook()
  console.log('[order-monitor] content script loaded', location.href)

  let platforms = []
  let platformsReady = false
  const pendingPayloads = []

  // 在 await storage 之前挂上 listener，避免早期 NETWORK_PAYLOAD 丢失
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
  checkLogin(platforms)

  for (const payload of pendingPayloads.splice(0)) {
    if (!platforms.length) break
    handleNetworkPayload(platforms, payload.url, payload.body)
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.platforms) return
    loadMatchingPlatforms().then((next) => {
      platforms = next
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
