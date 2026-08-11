import { MSG } from '../shared/messaging.js'
import {
  getState,
  saveSeenOrders,
  appendMailLog,
  setPendingMails,
  setSettings,
  upsertPlatform,
  removePlatform,
} from '../shared/storage.js'
import { diffNewOrders } from '../shared/orders.js'
import { buildOrderEmail } from '../shared/email.js'
import { sendWithRetry } from '../shared/resend.js'
import { getMailSender, isMailSenderConfigured } from '../shared/mail-config.js'
import { ensurePlatformAlarms, refreshPlatformTab } from './refresh.js'
import { bumpBadge } from './badge.js'

function mailSendArgs(toEmail, mail) {
  const sender = getMailSender()
  return {
    apiKey: sender.resendApiKey,
    from: sender.fromEmail,
    fromName: sender.fromName,
    to: toEmail,
    ...mail,
  }
}

async function syncAlarms() {
  const { platforms } = await getState()
  await ensurePlatformAlarms(platforms)
}

chrome.runtime.onInstalled.addListener(syncAlarms)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.platforms) syncAlarms()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('refresh:')) return
  const id = alarm.name.slice('refresh:'.length)
  const { settings, platforms } = await getState()
  if (!settings.enabled) return
  const platform = platforms.find((p) => p.id === id)
  if (!platform?.enabled) return
  await refreshPlatformTab(platform, settings.autoOpenOrderListTab)
})

/** 串行化 ORDERS_CANDIDATES，避免 API+DOM 并发交错 getState/diff/saveSeen */
let candidatesChain = Promise.resolve()

function enqueueCandidates(message) {
  const run = candidatesChain.then(() => handleCandidates(message))
  candidatesChain = run.then(
    () => {},
    () => {},
  )
  return run
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: e.message }))
  return true
})

async function handleMessage(message) {
  switch (message.type) {
    case MSG.GET_STATE:
      return { ok: true, ...(await getState()) }
    case MSG.SAVE_SETTINGS:
      return { ok: true, settings: await setSettings(message.payload) }
    case MSG.UPSERT_PLATFORM:
      await upsertPlatform(message.payload)
      await syncAlarms()
      return { ok: true }
    case MSG.REMOVE_PLATFORM:
      await removePlatform(message.payload.id)
      await syncAlarms()
      return { ok: true }
    case MSG.ORDERS_CANDIDATES:
      return enqueueCandidates(message)
    case MSG.LOGIN_DETECTED:
      return handleLoginDetected(message)
    case MSG.TEST_EMAIL:
      return handleTestEmail()
    case MSG.RETRY_PENDING:
      return retryPending()
    default:
      return { ok: false, error: 'unknown message' }
  }
}

async function handleLoginDetected({ platformId, href }) {
  const { platforms } = await getState()
  const platform = platforms.find((p) => p.id === platformId)
  if (!platform) return { ok: true, skipped: true }

  if (platform.enabled) {
    await upsertPlatform({ ...platform, enabled: false })
    await syncAlarms()
  }

  const name = platform.name || platformId
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '需要重新登录',
      message: `${name} 检测到登录页，已暂停该平台监控${href ? `：${href}` : ''}`,
    })
  } catch (_) {}

  return { ok: true, paused: true, platformId }
}

async function handleCandidates({ platformId, orders }) {
  const state = await getState()
  const platform = state.platforms.find((p) => p.id === platformId)
  if (!platform) return { ok: true, skipped: true }

  const { newOrders, nextSeen } = diffNewOrders(
    state.seenOrders,
    platformId,
    orders || [],
  )
  await saveSeenOrders(nextSeen)

  if (!state.settings.enabled || !platform.enabled) {
    return { ok: true, skipped: true, newCount: 0 }
  }
  if (!newOrders.length) return { ok: true, newCount: 0 }

  const batch = state.settings.mergeNewOrdersInOneEmail
    ? [newOrders]
    : newOrders.map((o) => [o])

  for (const group of batch) {
    const mail = buildOrderEmail({
      platformName: platform.name || platformId,
      orders: group,
    })
    const result = await sendWithRetry(mailSendArgs(state.settings.toEmail, mail))
    await appendMailLog({
      at: Date.now(),
      platformId,
      orderIds: group.map((o) => o.orderId),
      ok: result.ok,
      error: result.error,
    })
    if (result.ok) {
      await bumpBadge(group.length)
      try {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: '新订单',
          message: `${platform.name} ${group.length} 单已发信`,
        })
      } catch (_) {}
    } else {
      const pending = [
        ...(await getState()).pendingMails,
        { platformId, orders: group, mail, at: Date.now() },
      ]
      await setPendingMails(pending)
      try {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: '发信失败',
          message: result.error || '请检查发信配置或收件邮箱',
        })
      } catch (_) {}
    }
  }
  return { ok: true, newCount: newOrders.length }
}

async function handleTestEmail() {
  const { settings } = await getState()
  if (!isMailSenderConfigured()) {
    return { ok: false, error: '发信通道未配置（请开发者在 .env.local 填写 Resend）', id: null }
  }
  if (!settings.toEmail) {
    return { ok: false, error: '请先填写收件邮箱', id: null }
  }
  const mail = buildOrderEmail({
    platformName: '测试',
    orders: [{ orderId: 'TEST-001', fields: { 说明: '测试邮件' } }],
  })
  return sendWithRetry(mailSendArgs(settings.toEmail, mail))
}

async function retryPending() {
  const state = await getState()
  const left = []
  for (const item of state.pendingMails) {
    const result = await sendWithRetry(mailSendArgs(state.settings.toEmail, item.mail))
    await appendMailLog({
      at: Date.now(),
      platformId: item.platformId,
      orderIds: item.orders.map((o) => o.orderId),
      ok: result.ok,
      error: result.error,
    })
    if (!result.ok) left.push(item)
  }
  await setPendingMails(left)
  return { ok: true, remaining: left.length }
}
