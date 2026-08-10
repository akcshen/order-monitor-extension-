;(function () {
  const SOURCE = 'order-monitor-hook'

  function emit(url, body) {
    window.postMessage({ source: SOURCE, type: 'NETWORK_PAYLOAD', url, body }, '*')
  }

  function resolveUrl(input) {
    if (typeof input === 'string') return input
    if (input && typeof input.url === 'string') return input.url
    if (typeof URL !== 'undefined' && input instanceof URL) return input.href
    return ''
  }

  const rawFetch = window.fetch
  window.fetch = async function (...args) {
    const res = await rawFetch.apply(this, args)
    try {
      const url = resolveUrl(args[0])
      const clone = res.clone()
      clone
        .json()
        .then((body) => emit(url, body))
        .catch(() => {})
    } catch (_) {}
    return res
  }

  const rawOpen = XMLHttpRequest.prototype.open
  const rawSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__om_url = url
    return rawOpen.call(this, method, url, ...rest)
  }
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        const url = String(this.__om_url || '')
        const ct = this.getResponseHeader('content-type') || ''
        if (ct.includes('json') || /^\s*[\[{]/.test(this.responseText || '')) {
          emit(url, JSON.parse(this.responseText))
        }
      } catch (_) {}
    })
    return rawSend.apply(this, args)
  }
})()
