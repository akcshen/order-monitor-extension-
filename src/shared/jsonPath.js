function splitPath(path) {
  if (!path) return []
  return path.replace(/\[\]/g, '.[].').split('.').filter(Boolean)
}

export function getByPath(root, path) {
  const parts = splitPath(path)
  let cur = [root]
  for (const part of parts) {
    if (part === '[]') {
      cur = cur.flatMap((item) => (Array.isArray(item) ? item : []))
      continue
    }
    cur = cur.map((item) => (item == null ? undefined : item[part]))
  }
  if (parts.includes('[]')) return cur
  return cur[0]
}

function getRelative(obj, path) {
  const v = getByPath(obj, path)
  return v == null ? '' : String(v)
}

/**
 * orderIdPath 必须包含 []，指向订单号数组；同时用同一数组前缀取每条订单对象。
 * 例：data.list[].orderNo → 元素路径 data.list[]
 */
export function extractOrdersFromJson(json, orderIdPath, orderFields = []) {
  if (!orderIdPath || !orderIdPath.includes('[]')) return []
  const idx = orderIdPath.lastIndexOf('[]')
  const arrayPath = orderIdPath.slice(0, idx + 2)
  const idField = orderIdPath.slice(idx + 2).replace(/^\./, '')
  const rows = getByPath(json, arrayPath)
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => {
      const orderId = row == null ? '' : String(getByPath(row, idField) ?? '')
      if (!orderId) return null
      const fields = {}
      for (const f of orderFields) {
        fields[f.label] = getRelative(row, f.path)
      }
      return { orderId, fields }
    })
    .filter(Boolean)
}
