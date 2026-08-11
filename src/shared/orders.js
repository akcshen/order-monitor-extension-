const MAX_IDS = 5000

export function diffNewOrders(seen, platformId, orders) {
  const prev = seen[platformId] || { ids: [], baselineReady: false }
  const idSet = new Set(prev.ids)
  const incomingIds = orders.map((o) => o.orderId).filter(Boolean)

  if (!prev.baselineReady) {
    const ids = [...new Set([...prev.ids, ...incomingIds])].slice(-MAX_IDS)
    return {
      newOrders: [],
      nextSeen: {
        ...seen,
        [platformId]: { ids, baselineReady: true },
      },
    }
  }

  const newOrders = []
  for (const o of orders) {
    if (!o.orderId || idSet.has(o.orderId)) continue
    // 同批内重复 orderId 只接受第一条
    idSet.add(o.orderId)
    newOrders.push(o)
  }
  const ids = [...idSet].slice(-MAX_IDS)
  return {
    newOrders,
    nextSeen: {
      ...seen,
      [platformId]: { ids, baselineReady: true },
    },
  }
}
