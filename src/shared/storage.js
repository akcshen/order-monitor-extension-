import {
  DEFAULT_SETTINGS,
  DEFAULT_SEEN,
  DEFAULT_MAIL_LOGS,
  DEFAULT_PENDING,
} from './types.js'

const KEYS = {
  settings: 'settings',
  platforms: 'platforms',
  seenOrders: 'seenOrders',
  mailLogs: 'mailLogs',
  pendingMails: 'pendingMails',
}

export async function getState() {
  const data = await chrome.storage.local.get([
    KEYS.settings,
    KEYS.platforms,
    KEYS.seenOrders,
    KEYS.mailLogs,
    KEYS.pendingMails,
  ])
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      enabled: data.settings?.enabled ?? DEFAULT_SETTINGS.enabled,
      toEmail: data.settings?.toEmail ?? DEFAULT_SETTINGS.toEmail,
      mergeNewOrdersInOneEmail:
        data.settings?.mergeNewOrdersInOneEmail ??
        DEFAULT_SETTINGS.mergeNewOrdersInOneEmail,
      autoOpenOrderListTab:
        data.settings?.autoOpenOrderListTab ?? DEFAULT_SETTINGS.autoOpenOrderListTab,
    },
    platforms: data.platforms || [],
    seenOrders: data.seenOrders || { ...DEFAULT_SEEN },
    mailLogs: data.mailLogs || [...DEFAULT_MAIL_LOGS],
    pendingMails: data.pendingMails || [...DEFAULT_PENDING],
  }
}

export async function setSettings(partial) {
  const { settings } = await getState()
  const merged = { ...settings, ...partial }
  // 只持久化用户侧字段；发信凭证走 mail-config / .env，不进 storage
  const next = {
    enabled: Boolean(merged.enabled),
    toEmail: String(merged.toEmail || '').trim(),
    mergeNewOrdersInOneEmail: Boolean(merged.mergeNewOrdersInOneEmail),
    autoOpenOrderListTab: Boolean(merged.autoOpenOrderListTab),
  }
  await chrome.storage.local.set({ [KEYS.settings]: next })
  return next
}

export async function upsertPlatform(platform) {
  const { platforms } = await getState()
  const idx = platforms.findIndex((p) => p.id === platform.id)
  const next = [...platforms]
  if (idx >= 0) next[idx] = platform
  else next.push(platform)
  await chrome.storage.local.set({ [KEYS.platforms]: next })
  return next
}

export async function getPlatformById(id) {
  const { platforms } = await getState()
  return platforms.find((p) => p.id === id) || null
}

export async function removePlatform(id) {
  const { platforms, seenOrders } = await getState()
  const next = platforms.filter((p) => p.id !== id)
  const seen = { ...seenOrders }
  delete seen[id]
  await chrome.storage.local.set({
    [KEYS.platforms]: next,
    [KEYS.seenOrders]: seen,
  })
  return next
}

export async function saveSeenOrders(seenOrders) {
  await chrome.storage.local.set({ [KEYS.seenOrders]: seenOrders })
}

export async function appendMailLog(entry) {
  const { mailLogs } = await getState()
  const next = [entry, ...mailLogs].slice(0, 100)
  await chrome.storage.local.set({ [KEYS.mailLogs]: next })
  return next
}

export async function setPendingMails(pendingMails) {
  await chrome.storage.local.set({ [KEYS.pendingMails]: pendingMails })
}
