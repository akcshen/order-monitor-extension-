import { MSG } from '../shared/messaging.js'
import { extractOrdersFromJson } from '../shared/jsonPath.js'
import { parseOrdersFromDom } from './dom-parser.js'
import { BUILTIN_PLATFORMS } from '../shared/builtin-platforms.js'
import {
  hrefMatchesPlatform,
  normalizeBuiltinPlatform,
} from '../shared/builtin-platform-utils.js'
// Vite 将钩子源码作为字符串打包，便于同步注入，减少错过首屏请求
import hookSource from '../injected/network-hook.js?raw'

const HOOK_SOURCE = 'order-monitor-hook'

function configuredBuiltins() {
  return BUILTIN_PLATFORMS.filter(
    (d) => d?.orderListUrl && !String(d.orderListUrl).includes('REPLACE_ME'),
  ).map((d) => normalizeBuiltinPlatform(d))
}

function injectNetworkHookSync() {
  if (window.__orderMonitorHookInstalled) return
  try {
    const s = document.createElement('script')
    s.textContent = hookSource
    ;(document.documentElement || document.head).appendChild(s)
    s.remove()
    window.__orderMonitorHookInstalled = true
  } catch (_) {
    // CSP 禁止 inline 时回退 WAR
    try {
      const s = document.createElement('script')
      s.src = chrome.runtime.getURL('src/injected/network-hook.js')
      ;(document.documentElement || document.head).appendChild(s)
      s.remove()
      window.__orderMonitorHookInstalled = true
    } catch (__) {}
  }
}

async function loadStoragePlatforms() {
  const { platforms = [] } = await chrome.storage.local.get('platforms')
  return Array.isArray(platforms) ? platforms : []
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
    if (!platform.enabled) continue
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
  const active = platforms.filter((p) => p.enabled)
  for (const platform of active) {
    if (!platform.apiUrlIncludes || !urlStr.includes(platform.apiUrlIncludes)) continue
    urlMatched = true
    const orders = extractOrdersFromJson(body, platform.orderIdPath, platform.orderFields)
    if (orders.length) {
      sendOrders(platform.id, orders, 'api')
      extracted = true
    }
  }
  if (urlMatched && !extracted) {
    tryDomParse(active)
  }
}

function isLoginHref(platform, href) {
  return Boolean(platform.loginUrlIncludes && href.includes(platform.loginUrlIncludes))
}

function syncLoginState(matchingPlatforms) {
  const href = location.href
  for (const platform of matchingPlatforms) {
    if (isLoginHref(platform, href)) {
      if (platform.enabled) {
        chrome.runtime
          .sendMessage({
            type: MSG.LOGIN_DETECTED,
            platformId: platform.id,
            href,
          })
          .catch(() => {})
      }
    } else if (platform.pausedByLogin) {
      chrome.runtime
        .sendMessage({
          type: MSG.RESUME_PLATFORM,
          platformId: platform.id,
        })
        .catch(() => {})
    }
  }
}

async function main() {
  const href = location.href
  const syncHits = configuredBuiltins().filter((p) => hrefMatchesPlatform(p, href))

  // 同步命中内置规则时立刻挂钩，尽量赶上首屏请求
  if (syncHits.length) {
    injectNetworkHookSync()
  }

  let platforms = []
  let matchingAll = []
  let platformsReady = false
  const pendingPayloads = []

  const onMessage = (event) => {
    if (event.source !== window) return
    const data = event.data
    if (!data || data.source !== HOOK_SOURCE || data.type !== 'NETWORK_PAYLOAD') return
    if (!platformsReady) {
      pendingPayloads.push({ url: data.url, body: data.body })
      return
    }
    if (!platforms.length) return
    handleNetworkPayload(platforms, data.url, data.body)
  }

  // 仅在有希望成为目标页时挂监听（内置同步命中，或稍后 storage 命中）
  let listening = false
  function ensureListening() {
    if (listening) return
    window.addEventListener('message', onMessage)
    listening = true
  }

  if (syncHits.length) ensureListening()

  const stored = await loadStoragePlatforms()
  matchingAll = stored.filter((p) => hrefMatchesPlatform(p, href))
  platforms = matchingAll.filter((p) => p.enabled)

  // 非目标页：不做后续工作
  if (!syncHits.length && !matchingAll.length) {
    return
  }

  ensureListening()
  if (!window.__orderMonitorHookInstalled && matchingAll.length) {
    injectNetworkHookSync()
  }

  platformsReady = true
  syncLoginState(matchingAll)

  for (const payload of pendingPayloads.splice(0)) {
    if (!platforms.length) break
    handleNetworkPayload(platforms, payload.url, payload.body)
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.platforms) return
    loadStoragePlatforms().then((list) => {
      matchingAll = list.filter((p) => hrefMatchesPlatform(p, location.href))
      platforms = matchingAll.filter((p) => p.enabled)
      if (matchingAll.length) {
        ensureListening()
        if (!window.__orderMonitorHookInstalled) injectNetworkHookSync()
      }
      syncLoginState(matchingAll)
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
