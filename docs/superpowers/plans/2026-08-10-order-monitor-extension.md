# 多平台订单监控扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `order-monitor-extension/` 内实现 Manifest V3 Chrome 扩展：可配置多平台、挂钩 fetch/XHR + DOM 兜底采集订单、本地去重后经 Resend 发真邮件。

**Architecture:** Popup（Vue3）读写规则；Content Script 注入 page 世界钩子并解析 DOM；Service Worker 负责 alarms 刷新标签页、seen 去重、Resend 发信与角标。纯逻辑（JSON Path、去重、邮件正文）用 Vitest 单测。

**Tech Stack:** Vue 3、Vite、Element Plus、`@crxjs/vite-plugin`、JavaScript（与用户栈一致，不用 TypeScript）、Vitest、Chrome Extension MV3、Resend HTTPS API

**Spec:** `docs/superpowers/specs/2026-08-10-order-monitor-extension-design.md`

## Global Constraints

- 全部代码只写在本仓库根（即 `order-monitor-extension/`），勿改父目录 `BrowserPlugins/`
- Manifest V3；不直连 SMTP；邮件只用 Resend
- 多平台靠配置，禁止写死某一商家平台逻辑
- 一期不做：录制助手、WebSocket、离线云监控
- Popup 用 Vue3 + Element Plus；源码优先 JavaScript
- 提交只在本仓库 `git`（已关联 `origin`）

---

## File Structure

```
order-monitor-extension/
  package.json
  vite.config.js
  vitest.config.js
  index.html                 # popup 入口
  manifest.config.js         # 或 vite 内联 manifest
  public/icons/icon128.png
  src/
    shared/
      types.js               # JSDoc typedef + 默认值
      storage.js             # chrome.storage 封装
      jsonPath.js            # 从 JSON 按 path 抽字段
      orders.js              # 去重 / 基线
      email.js               # 邮件 HTML/文本组装
      resend.js              # 调用 Resend
      messaging.js           # 消息类型常量
    injected/
      network-hook.js        # page 世界：钩 fetch + XHR
    content/
      main.js                # 注入钩子、听 postMessage、DOM 解析、上报
      dom-parser.js
    background/
      service-worker.js      # alarms、tabs、处理订单、角标
      refresh.js
      badge.js
    popup/
      main.js
      App.vue
      components/
        SettingsForm.vue
        PlatformList.vue
        PlatformEditor.vue
        MailLogList.vue
  tests/
    jsonPath.test.js
    orders.test.js
    email.test.js
    dom-parser.test.js
```

---

### Task 1: 脚手架（Vite + CRXJS + Vue3 + Element Plus + Vitest）

**Files:**
- Create: `package.json`, `vite.config.js`, `vitest.config.js`, `index.html`, `src/popup/main.js`, `src/popup/App.vue`, `src/background/service-worker.js`, `src/content/main.js`, `public/icons/icon128.png`
- Create: `README.md`（安装与加载说明）

**Interfaces:**
- Produces: 可 `npm run build` / `npm run dev` 的 CRX 工程；popup / background / content 空壳可加载

- [ ] **Step 1: 初始化 package.json 与依赖**

在仓库根执行：

```bash
cd /Users/kc/Desktop/申清峰/dosomething/xinxiaoproject/BrowserPlugins/order-monitor-extension
npm init -y
npm install vue element-plus
npm install -D vite @vitejs/plugin-vue @crxjs/vite-plugin@beta vitest jsdom @vue/test-utils
```

`package.json` scripts：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "type": "module"
}
```

- [ ] **Step 2: 写 vite.config.js（含 manifest）**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import { defineManifest } from '@crxjs/vite-plugin'

const manifest = defineManifest({
  manifest_version: 3,
  name: '订单监控助手',
  version: '0.1.0',
  description: '多平台新订单监控并邮件通知',
  action: {
    default_popup: 'index.html',
    default_title: '订单监控助手',
  },
  background: {
    service_worker: 'src/background/service-worker.js',
    type: 'module',
  },
  permissions: ['storage', 'alarms', 'tabs', 'notifications', 'scripting'],
  host_permissions: ['http://*/*', 'https://*/*'],
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/main.js'],
      run_at: 'document_start',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['src/injected/network-hook.js'],
      matches: ['http://*/*', 'https://*/*'],
    },
  ],
  icons: {
    128: 'public/icons/icon128.png',
  },
})

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        popup: 'index.html',
      },
    },
  },
})
```

若 `@crxjs/vite-plugin` 的 `defineManifest` 导入路径因版本不同报错，改为单独 `manifest.js` 导出对象并 `crx({ manifest })` 引用——以该版本文档为准，保持权限与入口一致。

- [ ] **Step 3: Popup / background / content 空壳**

`index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>订单监控助手</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/popup/main.js"></script>
  </body>
</html>
```

`src/popup/main.js`：

```js
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

createApp(App).use(ElementPlus).mount('#app')
```

`src/popup/App.vue`：

```vue
<template>
  <div style="width: 360px; padding: 12px">订单监控助手 · 脚手架就绪</div>
</template>
```

`src/background/service-worker.js`：

```js
console.log('[order-monitor] service worker loaded')
```

`src/content/main.js`：

```js
console.log('[order-monitor] content script loaded', location.href)
```

放一张 128×128 PNG 到 `public/icons/icon128.png`（可用纯色占位图）。

- [ ] **Step 4: Vitest 配置**

`vitest.config.js`：

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
})
```

- [ ] **Step 5: 验证构建**

```bash
npm run build
```

Expected: 成功产出 `dist/`，含 manifest 与 popup。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.js vitest.config.js index.html src public README.md
git -c alias.commit= commit -F - <<'EOF'
chore: scaffold Vue3 CRXJS extension project

EOF
```

（若环境 `git commit` 因 `--trailer` 失败，统一使用 `git -c alias.commit= commit`。）

---

### Task 2: 共享类型默认值、消息常量、storage 封装

**Files:**
- Create: `src/shared/types.js`, `src/shared/messaging.js`, `src/shared/storage.js`
- Test: `tests/storage.defaults.test.js`

**Interfaces:**
- Produces:
  - `DEFAULT_SETTINGS`, `createEmptyPlatform()`, `DEFAULT_STATE`
  - `MSG = { ORDERS_CANDIDATES, ... }`
  - `getState()`, `setSettings(partial)`, `upsertPlatform(p)`, `removePlatform(id)`, `getPlatformById(id)`

- [ ] **Step 1: 写失败测试（默认 settings 形状）**

`tests/storage.defaults.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, createEmptyPlatform } from '../src/shared/types.js'

describe('defaults', () => {
  it('DEFAULT_SETTINGS has required keys', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      enabled: true,
      resendApiKey: '',
      toEmail: '',
      fromEmail: '',
      fromName: '订单监控助手',
      mergeNewOrdersInOneEmail: true,
      autoOpenOrderListTab: true,
    })
  })

  it('createEmptyPlatform returns editable rule shell', () => {
    const p = createEmptyPlatform()
    expect(p.id).toBeTruthy()
    expect(p.refreshSeconds).toBe(60)
    expect(p.orderFields).toEqual([])
    expect(p.fieldSelectors).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npm test -- tests/storage.defaults.test.js
```

Expected: FAIL module not found / export missing

- [ ] **Step 3: 实现 types / messaging / storage**

`src/shared/types.js`：

```js
export const DEFAULT_SETTINGS = {
  enabled: true,
  resendApiKey: '',
  toEmail: '',
  fromEmail: '',
  fromName: '订单监控助手',
  mergeNewOrdersInOneEmail: true,
  autoOpenOrderListTab: true,
}

export function createEmptyPlatform() {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    matchUrls: [],
    orderListUrl: '',
    refreshSeconds: 60,
    apiUrlIncludes: '',
    orderIdPath: '',
    orderFields: [],
    rowSelector: '',
    orderIdSelector: '',
    fieldSelectors: [],
    loginUrlIncludes: 'login',
  }
}

export const DEFAULT_SEEN = {}
export const DEFAULT_MAIL_LOGS = []
export const DEFAULT_PENDING = []
```

`src/shared/messaging.js`：

```js
export const MSG = {
  ORDERS_CANDIDATES: 'ORDERS_CANDIDATES',
  NETWORK_PAYLOAD: 'NETWORK_PAYLOAD',
  GET_STATE: 'GET_STATE',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  UPSERT_PLATFORM: 'UPSERT_PLATFORM',
  REMOVE_PLATFORM: 'REMOVE_PLATFORM',
  TEST_EMAIL: 'TEST_EMAIL',
  RETRY_PENDING: 'RETRY_PENDING',
}
```

`src/shared/storage.js`：

```js
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
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    platforms: data.platforms || [],
    seenOrders: data.seenOrders || { ...DEFAULT_SEEN },
    mailLogs: data.mailLogs || [...DEFAULT_MAIL_LOGS],
    pendingMails: data.pendingMails || [...DEFAULT_PENDING],
  }
}

export async function setSettings(partial) {
  const { settings } = await getState()
  const next = { ...settings, ...partial }
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
```

- [ ] **Step 4: 跑测试通过**

```bash
npm test -- tests/storage.defaults.test.js
```

Expected: PASS（`storage.js` 依赖 `chrome` 的函数本任务可不测，仅测 defaults）

- [ ] **Step 5: Commit**

```bash
git add src/shared tests/storage.defaults.test.js
git -c alias.commit= commit -F - <<'EOF'
feat: add shared defaults, messaging, and storage helpers

EOF
```

---

### Task 3: JSON Path 抽取（接口模式核心）

**Files:**
- Create: `src/shared/jsonPath.js`
- Test: `tests/jsonPath.test.js`

**Interfaces:**
- Produces:
  - `getByPath(root, path) => any`
  - `extractOrdersFromJson(json, orderIdPath, orderFields) => Array<{ orderId: string, fields: Record<string,string> }>`
- Path 约定：`data.list[].orderNo`；`[]` 表示数组展开；字段 path 相对单条订单对象，如 `shopName` 或相对根如 `data.list[].amount`（实现时：`orderFields[].path` 为**相对订单元素**的路径，如 `shopName`、`amount`、`items[0].name`）

- [ ] **Step 1: 写失败测试**

`tests/jsonPath.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { getByPath, extractOrdersFromJson } from '../src/shared/jsonPath.js'

describe('getByPath', () => {
  it('reads nested keys', () => {
    expect(getByPath({ a: { b: 1 } }, 'a.b')).toBe(1)
  })

  it('expands array with []', () => {
    const data = { list: [{ id: '1' }, { id: '2' }] }
    expect(getByPath(data, 'list[].id')).toEqual(['1', '2'])
  })
})

describe('extractOrdersFromJson', () => {
  it('builds orders from list path', () => {
    const json = {
      data: {
        list: [
          { orderNo: 'A1', shopName: '华润', amount: 12.5 },
          { orderNo: 'A2', shopName: '永辉', amount: 9 },
        ],
      },
    }
    const orders = extractOrdersFromJson(json, 'data.list[].orderNo', [
      { label: '超市', path: 'shopName' },
      { label: '金额', path: 'amount' },
    ])
    expect(orders).toEqual([
      { orderId: 'A1', fields: { 超市: '华润', 金额: '12.5' } },
      { orderId: 'A2', fields: { 超市: '永辉', 金额: '9' } },
    ])
  })

  it('skips rows without orderId', () => {
    const json = { list: [{ orderNo: '' }, { orderNo: 'B1' }] }
    const orders = extractOrdersFromJson(json, 'list[].orderNo', [])
    expect(orders).toEqual([{ orderId: 'B1', fields: {} }])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npm test -- tests/jsonPath.test.js
```

Expected: FAIL

- [ ] **Step 3: 实现 jsonPath.js**

```js
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
  const elemPath = orderIdPath.replace(/\.?[^.\[]+$/, '') // 去掉最后一段字段名，保留至 []
  // 更稳妥：找到最后一个 [] 及其前缀
  const idx = orderIdPath.lastIndexOf('[]')
  const arrayPath = orderIdPath.slice(0, idx + 2) // 含 []
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
```

实现时以测试为准微调 `arrayPath` / `idField` 解析；删掉未使用的 `elemPath` 变量。

- [ ] **Step 4: 跑测试通过**

```bash
npm test -- tests/jsonPath.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/jsonPath.js tests/jsonPath.test.js
git -c alias.commit= commit -F - <<'EOF'
feat: add JSON path order extraction

EOF
```

---

### Task 4: 订单去重与首次基线

**Files:**
- Create: `src/shared/orders.js`
- Test: `tests/orders.test.js`

**Interfaces:**
- Consumes: seen 结构 `{ [platformId]: { ids: string[], baselineReady: boolean } }`
- Produces: `diffNewOrders(seen, platformId, orders) => { newOrders, nextSeen }`；首次基线 `newOrders` 为空且 `baselineReady` 变 true；每平台 `ids` 最多保留 5000

- [ ] **Step 1: 写失败测试**

```js
import { describe, it, expect } from 'vitest'
import { diffNewOrders } from '../src/shared/orders.js'

describe('diffNewOrders', () => {
  it('first run only builds baseline', () => {
    const seen = {}
    const { newOrders, nextSeen } = diffNewOrders(seen, 'p1', [
      { orderId: '1', fields: {} },
      { orderId: '2', fields: {} },
    ])
    expect(newOrders).toEqual([])
    expect(nextSeen.p1.baselineReady).toBe(true)
    expect(nextSeen.p1.ids).toEqual(['1', '2'])
  })

  it('returns only unseen orders after baseline', () => {
    const seen = { p1: { ids: ['1', '2'], baselineReady: true } }
    const { newOrders, nextSeen } = diffNewOrders(seen, 'p1', [
      { orderId: '2', fields: {} },
      { orderId: '3', fields: { 超市: '永辉' } },
    ])
    expect(newOrders).toEqual([{ orderId: '3', fields: { 超市: '永辉' } }])
    expect(nextSeen.p1.ids).toContain('3')
  })
})
```

- [ ] **Step 2: 跑测试失败 → 实现 → 通过**

`src/shared/orders.js`：

```js
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
```

```bash
npm test -- tests/orders.test.js
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/shared/orders.js tests/orders.test.js
git -c alias.commit= commit -F - <<'EOF'
feat: add order baseline and dedupe logic

EOF
```

---

### Task 5: 邮件正文 + Resend 客户端

**Files:**
- Create: `src/shared/email.js`, `src/shared/resend.js`
- Test: `tests/email.test.js`

**Interfaces:**
- Produces:
  - `buildOrderEmail({ platformName, orders, now }) => { subject, text, html }`
  - `sendResendEmail({ apiKey, from, fromName, to, subject, text, html }) => { ok, error, id }`
  - `sendWithRetry(args, { retries: 2 })`

- [ ] **Step 1: 邮件组装测试**

```js
import { describe, it, expect } from 'vitest'
import { buildOrderEmail } from '../src/shared/email.js'

describe('buildOrderEmail', () => {
  it('builds subject and includes order id', () => {
    const mail = buildOrderEmail({
      platformName: '测试平台',
      orders: [{ orderId: 'X9', fields: { 超市: '华润' } }],
      now: new Date('2026-08-10T10:00:00+08:00'),
    })
    expect(mail.subject).toContain('测试平台')
    expect(mail.subject).toContain('1 单')
    expect(mail.text).toContain('X9')
    expect(mail.html).toContain('华润')
  })
})
```

- [ ] **Step 2: 实现 email.js 与 resend.js**

`src/shared/email.js`：

```js
export function buildOrderEmail({ platformName, orders, now = new Date() }) {
  const n = orders.length
  const time = now.toLocaleString('zh-CN', { hour12: false })
  const subject = `【新订单】${platformName} · ${n} 单 · ${time}`
  const lines = orders.map((o) => {
    const extras = Object.entries(o.fields || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('，')
    return `- ${o.orderId}${extras ? `（${extras}）` : ''}`
  })
  const text = [`平台：${platformName}`, `时间：${time}`, '', ...lines].join('\n')
  const rows = orders
    .map((o) => {
      const tds = [
        `<td>${escapeHtml(o.orderId)}</td>`,
        ...Object.values(o.fields || {}).map((v) => `<td>${escapeHtml(v)}</td>`),
      ].join('')
      return `<tr>${tds}</tr>`
    })
    .join('')
  const headers = ['订单号', ...Object.keys(orders[0]?.fields || {})]
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join('')
  const html = `<p>平台：${escapeHtml(platformName)}</p><p>时间：${escapeHtml(
    time,
  )}</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`
  return { subject, text, html }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

`src/shared/resend.js`：

```js
export async function sendResendEmail({
  apiKey,
  from,
  fromName,
  to,
  subject,
  text,
  html,
}) {
  if (!apiKey) return { ok: false, error: '缺少 Resend API Key', id: null }
  if (!to) return { ok: false, error: '缺少收件邮箱', id: null }
  if (!from) return { ok: false, error: '缺少发件邮箱', id: null }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${from}>` : from,
        to: [to],
        subject,
        text,
        html,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || `HTTP ${res.status}`,
        id: null,
      }
    }
    return { ok: true, error: null, id: data.id || null }
  } catch (e) {
    return { ok: false, error: e.message || String(e), id: null }
  }
}

export async function sendWithRetry(args, { retries = 2 } = {}) {
  let last = null
  for (let i = 0; i <= retries; i++) {
    last = await sendResendEmail(args)
    if (last.ok) return last
  }
  return last
}
```

- [ ] **Step 3: 测试通过并 Commit**

```bash
npm test -- tests/email.test.js
git add src/shared/email.js src/shared/resend.js tests/email.test.js
git -c alias.commit= commit -F - <<'EOF'
feat: add email builder and Resend client with retry

EOF
```

---

### Task 6: DOM 解析兜底

**Files:**
- Create: `src/content/dom-parser.js`
- Test: `tests/dom-parser.test.js`

**Interfaces:**
- Produces: `parseOrdersFromDom(root, { rowSelector, orderIdSelector, fieldSelectors }) => orders[]`

- [ ] **Step 1: 测试 + 实现**

```js
import { describe, it, expect } from 'vitest'
import { parseOrdersFromDom } from '../src/content/dom-parser.js'

describe('parseOrdersFromDom', () => {
  it('parses rows', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr class="row"><td class="no">O1</td><td class="shop">华润</td></tr>
        <tr class="row"><td class="no">O2</td><td class="shop">永辉</td></tr>
      </tbody></table>`
    const orders = parseOrdersFromDom(document, {
      rowSelector: 'tr.row',
      orderIdSelector: '.no',
      fieldSelectors: [{ label: '超市', selector: '.shop' }],
    })
    expect(orders).toEqual([
      { orderId: 'O1', fields: { 超市: '华润' } },
      { orderId: 'O2', fields: { 超市: '永辉' } },
    ])
  })
})
```

`src/content/dom-parser.js`：

```js
export function parseOrdersFromDom(root, rule) {
  const { rowSelector, orderIdSelector, fieldSelectors = [] } = rule || {}
  if (!rowSelector || !orderIdSelector) return []
  const rows = root.querySelectorAll(rowSelector)
  const orders = []
  rows.forEach((row) => {
    const idEl = row.querySelector(orderIdSelector)
    const orderId = (idEl?.textContent || '').trim()
    if (!orderId) return
    const fields = {}
    for (const f of fieldSelectors) {
      const el = row.querySelector(f.selector)
      fields[f.label] = (el?.textContent || '').trim()
    }
    orders.push({ orderId, fields })
  })
  return orders
}
```

- [ ] **Step 2: Commit**

```bash
npm test -- tests/dom-parser.test.js
git add src/content/dom-parser.js tests/dom-parser.test.js
git -c alias.commit= commit -F - <<'EOF'
feat: add DOM order parser fallback

EOF
```

---

### Task 7: Page 世界网络钩子 + Content 桥接上报

**Files:**
- Create: `src/injected/network-hook.js`
- Modify: `src/content/main.js`
- Ensure manifest `web_accessible_resources` 含 injected 脚本（Task 1 已声明）

**Interfaces:**
- Injected → `window.postMessage({ source: 'order-monitor-hook', type: 'NETWORK_PAYLOAD', url, body })`
- Content → `chrome.runtime.sendMessage({ type: MSG.ORDERS_CANDIDATES, platformId, orders, source: 'api'|'dom' })`
- Content 根据 `platforms` 匹配当前 URL；API 命中用 `extractOrdersFromJson`；否则 DOM

- [ ] **Step 1: 实现 network-hook.js**

```js
;(function () {
  const SOURCE = 'order-monitor-hook'

  function emit(url, body) {
    window.postMessage({ source: SOURCE, type: 'NETWORK_PAYLOAD', url, body }, '*')
  }

  const rawFetch = window.fetch
  window.fetch = async function (...args) {
    const res = await rawFetch.apply(this, args)
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
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
```

- [ ] **Step 2: 实现 content/main.js**

要点：

1. `const s = document.createElement('script'); s.src = chrome.runtime.getURL('src/injected/network-hook.js'); (document.documentElement || document.head).appendChild(s); s.remove()`
2. `chrome.storage.local` 取 platforms，找 `enabled` 且 `matchUrls` 匹配当前 href 的平台（简单：`matchUrls` 任一条用 `pathname+host` includes 或支持 `*` 通配——实现 `urlMatches(pattern, href)`：把 `*` 转正则）
3. 听 `message`：`data.source === 'order-monitor-hook'` 时，若 `url` includes `apiUrlIncludes`，则 `extractOrdersFromJson` 并 `sendMessage`
4. `document` 变为 ready 后跑一次 DOM parse；也可在每次 NETWORK 未抽出订单时尝试 DOM
5. 若 `loginUrlIncludes` 且 href 包含之，发消息告知 background 暂停（可选：`MSG.LOGIN_DETECTED`）

完整 `urlMatches`：

```js
export function urlMatches(pattern, href) {
  if (!pattern) return false
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + escaped + '$').test(href) || href.includes(pattern.replace(/\*/g, ''))
}
```

（放 `src/shared/urlMatch.js` 并加单测更佳；至少 content 内可用。）

- [ ] **Step 3: 本地手工验证钩子（无真实平台时）**

在任意页 Console 无法直接测扩展隔离；用 `npm run build` 后加载 `dist`，打开测试 HTML 页（可临时 `tests/fixtures/hook-demo.html` 用 fetch 返回 JSON），配置 matchUrls 指向该文件的 `file://` 或起一个 `npx serve`。

最小验证：content console 出现 loaded；触发 fetch 后 background 收到消息（可先 `console.log`）。

- [ ] **Step 4: Commit**

```bash
git add src/injected src/content src/shared/urlMatch.js tests || true
git -c alias.commit= commit -F - <<'EOF'
feat: inject fetch/XHR hooks and content bridge

EOF
```

---

### Task 8: Service Worker — 刷新、处理候选订单、发信、角标

**Files:**
- Create: `src/background/refresh.js`, `src/background/badge.js`
- Modify: `src/background/service-worker.js`

**Interfaces:**
- Consumes: `diffNewOrders`, `buildOrderEmail`, `sendWithRetry`, storage helpers, `MSG`
- Alarms name: `refresh:${platformId}`
- 处理 `ORDERS_CANDIDATES`：去重 → 发信 → log → pending → badge
- `chrome.alarms.onAlarm` → reload 或 `tabs.create(orderListUrl)`

- [ ] **Step 1: refresh.js**

```js
export async function ensurePlatformAlarms(platforms) {
  const all = await chrome.alarms.getAll()
  for (const a of all) {
    if (a.name.startsWith('refresh:')) await chrome.alarms.clear(a.name)
  }
  for (const p of platforms) {
    if (!p.enabled || !p.orderListUrl) continue
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
```

注意：MV3 `periodInMinutes` 最小约 0.5～1（Chrome 限制）；若需更短刷新，可在已打开页依赖站点自身轮询 + 钩子，alarm 作保底。文档/Popup 提示「受 Chrome 限制，alarm 最短约 30s」。

- [ ] **Step 2: badge.js**

```js
let todayKey = ''
let todayCount = 0

export async function bumpBadge(n = 1) {
  const key = new Date().toDateString()
  if (key !== todayKey) {
    todayKey = key
    todayCount = 0
  }
  todayCount += n
  await chrome.action.setBadgeText({ text: String(todayCount) })
  await chrome.action.setBadgeBackgroundColor({ color: '#d4380d' })
}
```

- [ ] **Step 3: service-worker 主逻辑**

```js
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
import { ensurePlatformAlarms, refreshPlatformTab } from './refresh.js'
import { bumpBadge } from './badge.js'

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((e) =>
    sendResponse({ ok: false, error: e.message }),
  )
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
      return handleCandidates(message)
    case MSG.TEST_EMAIL:
      return handleTestEmail()
    case MSG.RETRY_PENDING:
      return retryPending()
    default:
      return { ok: false, error: 'unknown message' }
  }
}

async function handleCandidates({ platformId, orders }) {
  const state = await getState()
  if (!state.settings.enabled) return { ok: true, skipped: true }
  const platform = state.platforms.find((p) => p.id === platformId)
  if (!platform?.enabled) return { ok: true, skipped: true }
  const { newOrders, nextSeen } = diffNewOrders(
    state.seenOrders,
    platformId,
    orders || [],
  )
  await saveSeenOrders(nextSeen)
  if (!newOrders.length) return { ok: true, newCount: 0 }

  const batch = state.settings.mergeNewOrdersInOneEmail
    ? [newOrders]
    : newOrders.map((o) => [o])

  for (const group of batch) {
    const mail = buildOrderEmail({
      platformName: platform.name || platformId,
      orders: group,
    })
    const result = await sendWithRetry({
      apiKey: state.settings.resendApiKey,
      from: state.settings.fromEmail,
      fromName: state.settings.fromName,
      to: state.settings.toEmail,
      ...mail,
    })
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
          message: result.error || '请检查 Resend 配置',
        })
      } catch (_) {}
    }
  }
  return { ok: true, newCount: newOrders.length }
}

async function handleTestEmail() {
  const { settings } = await getState()
  const mail = buildOrderEmail({
    platformName: '测试',
    orders: [{ orderId: 'TEST-001', fields: { 说明: '测试邮件' } }],
  })
  return sendWithRetry({
    apiKey: settings.resendApiKey,
    from: settings.fromEmail,
    fromName: settings.fromName,
    to: settings.toEmail,
    ...mail,
  })
}

async function retryPending() {
  const state = await getState()
  const left = []
  for (const item of state.pendingMails) {
    const result = await sendWithRetry({
      apiKey: state.settings.resendApiKey,
      from: state.settings.fromEmail,
      fromName: state.settings.fromName,
      to: state.settings.toEmail,
      ...item.mail,
    })
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
```

- [ ] **Step 4: Commit**

```bash
git add src/background
git -c alias.commit= commit -F - <<'EOF'
feat: process candidates, refresh tabs, send mail in service worker

EOF
```

---

### Task 9: Popup UI（设置 / 平台 CRUD / 日志）

**Files:**
- Modify: `src/popup/App.vue`, `src/popup/main.js`
- Create: `src/popup/components/SettingsForm.vue`, `PlatformList.vue`, `PlatformEditor.vue`, `MailLogList.vue`

**Interfaces:**
- Popup 经 `chrome.runtime.sendMessage` 使用 Task 8 的 MSG
- 平台编辑表单字段与 spec 一致；`matchUrls` / `orderFields` 用可增删行

- [ ] **Step 1: App.vue 布局**

宽度约 420px；区块：总开关与邮件设置 → 测试发信 → 平台列表 → 最近日志 → 待补发重试。

- [ ] **Step 2: SettingsForm**

绑定：`enabled`, `resendApiKey`, `toEmail`, `fromEmail`, `fromName`, `mergeNewOrdersInOneEmail`, `autoOpenOrderListTab`；保存调 `SAVE_SETTINGS`。

- [ ] **Step 3: PlatformEditor**

字段：name、enabled、matchUrls（多行文本每行一个）、orderListUrl、refreshSeconds、apiUrlIncludes、orderIdPath、orderFields（label+path）、rowSelector、orderIdSelector、fieldSelectors、loginUrlIncludes。保存 `UPSERT_PLATFORM`，删除 `REMOVE_PLATFORM`。

- [ ] **Step 4: MailLogList + 待补发按钮**

展示 `mailLogs`；按钮触发 `RETRY_PENDING` / `TEST_EMAIL`，用 `ElMessage` 显示结果。

- [ ] **Step 5: 构建并在 Chrome 加载 `dist` 目测表单可用**

```bash
npm run build
```

Chrome → 扩展程序 → 加载已解压的扩展程序 → 选 `dist`。

- [ ] **Step 6: Commit**

```bash
git add src/popup
git -c alias.commit= commit -F - <<'EOF'
feat: add popup settings, platform editor, and mail logs

EOF
```

---

### Task 10: README、端到端检查清单、收尾

**Files:**
- Modify: `README.md`
- Modify: design status 可选改为「已实现计划见 plans」

- [ ] **Step 1: README 写清**

1. `npm install && npm run dev` / `npm run build`
2. Chrome 加载 `dist`
3. Resend：验证域名、创建 API Key、填 from/to
4. 配置平台规则示例（假 JSON path）
5. 首次开启只建基线不发历史单
6. 权限说明与 API Key 勿分享提醒

- [ ] **Step 2: 跑全量测试**

```bash
npm test
npm run build
```

Expected: 全部 PASS，build 成功。

- [ ] **Step 3: 手工 E2E（对照 spec §10）**

1. 配置 Resend，测试发信成功  
2. 用本地 demo 页 + 规则，首次采集不发信  
3. 改 demo 增加新 orderId，刷新后收到邮件  
4. 关掉 api 字段，只留 DOM，仍能检出  
5. 关闭订单 tab，确认 autoOpen 或提示行为符合配置  

- [ ] **Step 4: Commit & push**

```bash
git add README.md docs
git -c alias.commit= commit -F - <<'EOF'
docs: add install guide and verify build/tests

EOF
git push origin main
```

---

## Spec Coverage Checklist（自审）

| Spec 项 | Task |
|---------|------|
| 多平台可配置规则 | 2, 9 |
| fetch + XHR 挂钩读响应 | 7 |
| DOM 兜底 | 6, 7 |
| 定时刷新 / 自动开页 | 8 |
| 首次基线不发历史 | 4, 8 |
| seen 5000 上限 | 4 |
| Resend + 重试 + 待补发 | 5, 8, 9 |
| 合并一封邮件 | 8 + settings |
| 角标 / 通知 | 8 |
| 代码仅在子目录仓库 | Global Constraints |
| 不做 SMTP/录制/WebSocket | 未排任务 |

## Placeholder / 一致性自审

- 消息常量统一 `MSG.*`
- 订单形状统一 `{ orderId, fields }`
- storage / worker / popup 字段与 design §4 对齐
- Alarm 最短间隔受 Chrome 限制：已在 Task 8 注明

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-10-order-monitor-extension.md`.

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个 Task 开新子代理，Task 间复查，迭代快  
2. **Inline Execution** — 本会话按 executing-plans 连续做，设检查点  

你选哪一种？
