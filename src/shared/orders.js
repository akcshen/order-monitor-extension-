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

  const newOrders = orders.filter((o) => o.orderId && !idSet.has(o.orderId))
  for (const o of newOrders) idSet.add(o.orderId)
  const ids = [...idSet].slice(-MAX_IDS)
  return {
    newOrders,
    nextSeen: {
      ...seen,
      [platformId]: { ids, baselineReady: true },
    },
  }
}
