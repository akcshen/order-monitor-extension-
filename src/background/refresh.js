export async function ensurePlatformAlarms(platforms) {
  const all = await chrome.alarms.getAll()
  for (const a of all) {
    if (a.name.startsWith('refresh:')) await chrome.alarms.clear(a.name)
  }
  for (const p of platforms) {
    if (!p.enabled || !p.orderListUrl) continue
    // Chrome MV3 alarms: periodInMinutes 最小约 0.5～1；此处 clamp 到 ≥0.25，短间隔仍受浏览器限制
    const minutes = Math.max(15, Number(p.refreshSeconds) || 60) / 60
    await chrome.alarms.create(`refresh:${p.id}`, {
      periodInMinutes: Math.max(0.25, minutes),
    })
  }
}

export async function refreshPlatformTab(platform, autoOpen) {
  const url = platform.orderListUrl
  if (!url) return
  const tabs = await chrome.tabs.query({})
  const hit = tabs.find((t) => t.url && t.url.startsWith(url.split('?')[0]))
  if (hit?.id != null) {
    await chrome.tabs.reload(hit.id)
    return
  }
  if (autoOpen) await chrome.tabs.create({ url, active: false })
}
